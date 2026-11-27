import { z } from "zod";
import { basalamMediaUrl, type ProductMedia } from "./product-media";
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

export function productReels(html: string, id: string): string[] {
  const payload = /<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!payload) return [];
  const queries = JSON.parse(payload)?.props?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) return [];
  const query = queries.find(({ queryKey }) => Array.isArray(queryKey) &&
    queryKey[0] === "reels" && queryKey[1] === "product-reels" && String(queryKey[2]) === id);
  const pages = z.array(z.object({
    reels:z.array(z.object({ video:z.object({ url:z.string().nullish() }).nullish() }))
  })).safeParse(query?.state?.data?.pages);
  return pages.success ? pages.data.flatMap(page => page.reels.map(reel => reel.video?.url)).filter(basalamMediaUrl) : [];
}

export function basalamDraft(raw: unknown, reels: string[] = []) {
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
  for (const reel of reels) add("video",reel);
  const video = z.object({ original:z.string().nullish(), url:z.string().nullish() }).safeParse(p.video);
  add("video",video.success ? video.data.original || video.data.url : p.video);
  for (const item of p.photos ?? []) add("image",item.original);
  function offer(price: number | null | undefined, stock: number | null | undefined, sku?: string | null): Offer {
    const id = crypto.randomUUID();
    const toman = Math.round((price ?? 0) / 10);
    return { id, options:{}, price:toman, salePrice:null, stock:Math.floor(stock ?? 0), weight:Math.round(p.packaged_weight ?? p.net_weight ?? 0),
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
    gallery, category:p.category?.title,
    simple:offer(p.price,p.inventory,p.sku), attributes, variants };
}
