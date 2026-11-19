"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CreditCard, Expand, PackageCheck, Play, Share2, ShoppingBag, Store, Truck, X } from "lucide-react";
import { fa, money, selectionKey, type Product } from "@/lib/shared";
import type { ProductMedia } from "@/lib/product-media";
import { useCart } from "./cart-context";
import { ProductImage } from "./store-interactions";

export function ProductDetail({ product, category }: { product: Product; category?: string }) {
  const router = useRouter();
  const { add, items, ready } = useCart();
  const [selected,setSelected] = useState<Record<string,string>>({});
  const [photo,setPhoto] = useState("");
  const [feedback,setFeedback] = useState("");
  const [shareMessage,setShareMessage] = useState("");
  const galleryDialog = useRef<HTMLDialogElement>(null);

  const active = product.offers.filter((offer) => offer.active);
  const current = product.kind === "simple" ? active[0]
    : active.find((offer) => selectionKey(offer.options) === selectionKey(selected));
  const lowest = active.length ? Math.min(...active.map((offer) => offer.price)) : undefined;
  const hasPriceRange = lowest !== undefined && active.some((offer) => offer.price !== lowest);
  const complete = product.kind === "simple" || Object.keys(selected).length === product.attributes.length;
  const stock = current?.stock ?? 0;
  const inCart = items.find((item) => item.id === current?.id)?.quantity ?? 0;
  const canAdd = ready && !!current && stock > inCart && inCart < 99;
  const canBuy = ready && !!current && stock > 0 && (canAdd || (inCart > 0 && inCart <= stock));

  const media = new Map<string,ProductMedia>();
  const first = product.gallery[0];
  if (first?.kind === "video") media.set(first.url,first);
  if (product.image) media.set(product.image,{ kind:"image",url:product.image });
  for (const item of product.gallery) media.set(item.url,item);
  for (const offer of active) {
    if (offer.image) media.set(offer.image,{ kind:"image",url:offer.image });
  }
  const gallery = [...media.values()];
  const displayed = media.get(photo || current?.image || "") ?? gallery[0];
  const photos = gallery.filter((item) => item.kind === "image");

  function stepPhoto(direction: number, items = gallery) {
    const index = displayed ? items.indexOf(displayed) : -1;
    setPhoto(items[(index + direction + items.length) % items.length].url);
  }

  function addItem(proceed: boolean) {
    if (!current) return;
    if (canAdd && (!proceed || !inCart)) {
      const variant = product.attributes.map((attribute) =>
        attribute.values.find((value) => value.id === current.options[attribute.id])?.name).join(" / ");
      add({ id:current.id,productId:product.id,title:product.title,price:current.price,
        image:current.image || product.image,variant,quantity:1 },stock);
    }
    if (proceed) router.push("/checkout");
    else setFeedback("به سبد خرید اضافه شد.");
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title:product.title,url:window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("پیوند کالا کپی شد.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setShareMessage("کپی پیوند ممکن نشد. نشانی را از مرورگر بردارید.");
      }
    }
  }

  const status = current
    ? stock === 0 ? "ناموجود" : stock <= 3 ? `فقط ${fa(stock)} عدد مانده` : "موجود در فروشگاه"
    : complete ? "این ترکیب موجود نیست" : "ویژگی‌های کالا را انتخاب کنید";
  const price = current ? money(current.price)
    : !complete && lowest !== undefined ? `${hasPriceRange ? "از " : ""}${money(lowest)}` : "—";

  return <div className="product-detail">
    <section className="pdp-gallery" aria-label="عکس و ویدئوی کالا">
      {gallery.length > 0 && <div className="pdp-thumbnails" aria-label="انتخاب عکس یا ویدئو">
        {gallery.map((item,index) => <button type="button" key={item.url} aria-label={`${item.kind === "video" ? "ویدئو" : "تصویر"} ${fa(index+1)}`}
          aria-pressed={item.url === displayed?.url} onClick={() => setPhoto(item.url)}>
          {item.kind === "video" ? <span className="pdp-video-thumbnail"><Play size={19}/></span> : <img src={item.url} alt=""/>}
        </button>)}
      </div>}
      <div className="pdp-frame">
        {displayed?.kind === "video" ? <video key={displayed.url} className="detail-image" src={displayed.url}
          controls playsInline preload="metadata" aria-label={`ویدئوی ${product.title}`}/>
          : <ProductImage className="detail-image" src={displayed?.url || ""} title={product.title}/>}
        <div className="pdp-gallery-tools">
          <button type="button" className="icon-link" aria-label="اشتراک‌گذاری کالا" onClick={share}><Share2 size={18}/></button>
          {displayed?.kind === "image" && <button type="button" className="icon-link" aria-label="بزرگ‌نمایی تصویر"
            onClick={() => galleryDialog.current?.showModal()}><Expand size={18}/></button>}
        </div>
        {gallery.length > 1 && <>
          <button type="button" className="icon-link gallery-prev" aria-label="تصویر قبلی" onClick={() => stepPhoto(-1)}><ChevronRight size={19}/></button>
          <button type="button" className="icon-link gallery-next" aria-label="تصویر بعدی" onClick={() => stepPhoto(1)}><ChevronLeft size={19}/></button>
        </>}
        {shareMessage && <span className="pdp-share-status" role="status">{shareMessage}</span>}
      </div>
      <dialog className="pdp-image-dialog" ref={galleryDialog} aria-label="نمای بزرگ تصویر">
        <form method="dialog"><button className="icon-link" aria-label="بستن تصویر"><X size={20}/></button></form>
        {displayed?.kind === "image" && <img src={displayed.url} alt={product.title}/>}
        {photos.length > 1 && <div className="pdp-dialog-controls">
          <button type="button" className="icon-link" aria-label="عکس قبلی" onClick={() => stepPhoto(-1,photos)}><ChevronRight size={19}/></button>
          <span>{fa(photos.findIndex((item) => item === displayed)+1)} از {fa(photos.length)}</span>
          <button type="button" className="icon-link" aria-label="عکس بعدی" onClick={() => stepPhoto(1,photos)}><ChevronLeft size={19}/></button>
        </div>}
      </dialog>
    </section>

    <section className="pdp-buy flow" aria-label="خرید کالا">
      <div className="pdp-title">
        {category && <p>{category}</p>}
        <h1>{product.title}</h1>
      </div>
      {product.attributes.map((attribute) => <fieldset className="option-field" key={attribute.id}>
        <legend>{attribute.name}</legend><div className="options">
          {attribute.values.map((value) => <button type="button" key={value.id} aria-pressed={selected[attribute.id] === value.id}
            onClick={() => { setSelected({ ...selected,[attribute.id]:value.id }); setPhoto(""); setFeedback(""); }}>
            {value.name}
          </button>)}
        </div>
      </fieldset>)}
      <div className="pdp-price-row" aria-live="polite">
        <p className={current && stock ? "pdp-stock available" : "pdp-stock"}>{status}</p>
        <strong className="detail-price">{price}</strong>
      </div>
      <div className="pdp-actions">
        <button type="button" className="button primary" disabled={!canAdd} onClick={() => addItem(false)}>
          <ShoppingBag size={19}/> {inCart > 0 && inCart >= Math.min(stock,99) && current ? "سقف تعداد در سبد" : "افزودن به سبد خرید"}
        </button>
        <button type="button" className="button pdp-buy-now" disabled={!canBuy} onClick={() => addItem(true)}>خرید مستقیم</button>
      </div>
      {feedback && <div className="pdp-cart-feedback" role="status"><span><Check size={17}/>{feedback}</span>
        <Link href="/cart">مشاهدهٔ سبد <ArrowLeft size={15}/></Link></div>}
      <div className="pdp-shipping">
        <Truck size={21}/>
        <div><strong>ارسال سفارش</strong><p>هزینهٔ ارسال پس از انتخاب استان در مرحلهٔ ثبت سفارش محاسبه می‌شود.</p></div>
      </div>
      <div className="pdp-seller">
        <span className="pdp-seller-icon"><Store size={22}/></span>
        <div><strong>فروشگاه یونی‌شاپ</strong><Link href="/#products">مشاهدهٔ کالاهای فروشگاه <ArrowLeft size={15}/></Link></div>
      </div>
    </section>

    <div className="pdp-about flow">
      <div className="pdp-perks">
        <span><CreditCard size={20}/>پرداخت با زرین‌پال</span>
        <span><PackageCheck size={20}/>خرید بدون ساخت حساب</span>
      </div>
      {(product.description || !!current?.weight) && <section className="pdp-description flow" aria-labelledby="product-description">
        <h2 id="product-description">توضیحات کالا</h2>
        {!!current?.weight && <p className="pdp-weight">وزن: {fa(current.weight)} گرم</p>}
        {product.description && <p className="description">{product.description}</p>}
      </section>}
    </div>
  </div>;
}
