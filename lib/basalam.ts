import { z } from "zod";
import { galleryLimit, basalamMediaUrl, type ProductMedia } from "./product-media";
import type { Attribute, Offer } from "./shared";

const number = z.number().nonnegative().nullish();
const photo = z.object({ original:z.string().nullish() });
const source = z.object({
  title:z.string().trim().min(1), description:z.string().nullish(), summary:z.string().nullish(),
  photo:photo.nullish(), photos:z.array(photo).nullish(), video:z.unknown(),
  price:number, inventory:number, packaged_weight:number, net_weight:number, sku:z.string().nullish(),
  category:z.object({ title:z.string() }).nullish(),
  variants:z.array(z.object({
    price:number, stock:number, sku:z.string().nullish(),
    properties:z.array(z.object({ property:z.object({ id:z.number(), title:z.string() }),
      value:z.object({ id:z.number(), title:z.string() }) }))
  })).nullish()
});

export function basalamId(link: string) {
  const url = URL.parse(link);
  if (url?.protocol !== "https:" || !["basalam.com","www.basalam.com"].includes(url.host)) return;
  return /^\/[^/]+\/product\/(\d+)\/?$/.exec(url.pathname)?.[1];
}

export function basalamDraft(raw: unknown) {
  const p = source.parse(raw);
  const image = basalamMediaUrl(p.photo?.original) ? p.photo!.original! : "";
  const gallery: ProductMedia[] = [];
  const seen = new Set([image]);
  function add(kind: ProductMedia["kind"], url: unknown) {
    if (basalamMediaUrl(url) && !seen.has(url)) {
      gallery.push({kind,url});
      seen.add(url);
    }
  }
  const video = z.object({ original:z.string().nullish(), url:z.string().nullish() }).safeParse(p.video);
  add("video",video.success ? video.data.original || video.data.url : p.video);
  for (const item of p.photos ?? []) add("image",item.original);
  function offer(price: number | null | undefined, stock: number | null | undefined, sku?: string | null): Offer {
    const id = crypto.randomUUID();
    const toman = Math.round((price ?? 0) / 10);
    return { id, options:{}, price:toman, stock:Math.floor(stock ?? 0), weight:Math.round(p.packaged_weight ?? p.net_weight ?? 0),
      sku:sku || `US-${id.slice(0,8)}`, image:"", active:toman > 0, reserved:0 };
  }
  const attributes: Attribute[] = [];
  const variants = (p.variants ?? []).map(v => {
    const item = offer(v.price ?? p.price,v.stock,v.sku);
    for (const {property,value} of v.properties) {
      const id = String(property.id);
      let attribute = attributes.find(a => a.id === id);
      if (!attribute) {
        attribute = {id,name:property.title,values:[]};
        attributes.push(attribute);
      }
      const valueId = String(value.id);
      if (!attribute.values.some(v => v.id === valueId)) attribute.values.push({id:valueId,name:value.title});
      item.options[id] = valueId;
    }
    return item;
  });
  return { title:p.title.slice(0,150), description:(p.description || p.summary || "").slice(0,10000), image,
    gallery:gallery.slice(0,galleryLimit), omitted:Math.max(0,gallery.length-galleryLimit), category:p.category?.title,
    simple:offer(p.price,p.inventory,p.sku), attributes, variants };
}
