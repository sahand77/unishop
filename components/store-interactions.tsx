"use client";
import { validateRecipient } from "./validate-recipient";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ImageOff, Minus, Search, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { checkout, getQuote } from "@/app/actions";
import { fa, money, provinces, type Quote } from "@/lib/shared";
import { useCart } from "./cart-context";
import { PendingButton } from "./pending-button";

export function ProductImage({ src, title, className }: { src: string; title: string; className?: string }) {
  return src ? <img src={src} alt={title} className={className} />
    : <div className={`image-empty ${className || ""}`} role="img" aria-label="بدون تصویر"><ImageOff size={30}/></div>;
}

export function StoreSearch({ storeName }: { storeName: string }) {
  const search = useSearchParams().get("q") ?? "";
  return <form className="store-search" role="search" action="/#products" method="get">
    <button aria-label="جست‌وجو"><Search size={21}/></button>
    <input key={search} defaultValue={search} type="search" name="q" aria-label="جست‌وجوی کالا"
      placeholder={`جست‌وجو در ${storeName}`} maxLength={100}/>
  </form>;
}

export function CartLink() {
  const { items } = useCart();
  return <Link href="/cart" className="cart-link"><ShoppingBag size={18}/><span>سبد خرید</span>
    <span className="cart-count">{fa(items.reduce((sum,item) => sum+item.quantity,0))}</span></Link>;
}

export function CartScreen() {
  const { items, ready, setQuantity } = useCart();
  const subtotal = items.reduce((sum,item) => sum + item.quantity*item.price,0);
  if (!ready) return <p>در حال بارگذاری سبد خرید…</p>;
  if (!items.length) return <EmptyBasket/>;
  return <div className="split">
    <div className="panel basket">{items.map((item) => <article key={item.id} className="basket-item">
      <ProductImage className="basket-image" src={item.image} title={item.title}/>
      <div><Link href={`/products/${item.productId}`}><strong>{item.title}</strong></Link>
        {item.variant && <p>{item.variant}</p>}<span>{money(item.price)}</span></div>
      <div className="basket-actions"><div className="stepper">
        <button type="button" aria-label="افزایش تعداد" disabled={item.quantity >= 99} onClick={() => setQuantity(item.id,item.quantity+1)}><Plus size={16}/></button>
        <span>{fa(item.quantity)}</span>
        <button type="button" aria-label="کاهش تعداد" onClick={() => setQuantity(item.id,item.quantity-1)}><Minus size={16}/></button>
      </div><button className="icon-link" type="button" aria-label="حذف کالا" onClick={() => setQuantity(item.id,0)}><Trash2 size={17}/></button></div>
    </article>)}</div>
    <aside className="panel flow summary"><h2>خلاصهٔ سبد</h2><p><span>جمع کالاها</span><strong>{money(subtotal)}</strong></p>
      <Link className="button primary" href="/checkout">ادامه و ثبت سفارش <ArrowLeft size={17}/></Link>
    </aside>
  </div>;
}

function EmptyBasket() {
  return <div className="panel empty flow"><ShoppingBag size={34}/><h2>سبد خرید خالی است</h2>
    <Link href="/#products" className="button primary">دیدن محصولات</Link></div>;
}

const emptyCustomer = { name:"",mobile:"",province:"",city:"",address:"",postalCode:"" };
const digits = (value: string) => value.replace(/[۰-۹]/g,(char) => String(char.charCodeAt(0)-1776))
  .replace(/[٠-٩]/g,(char) => String(char.charCodeAt(0)-1632));

export function CheckoutScreen({ saved }: { saved: import("@/lib/profile").SavedAddress[] }) {
  const [selected, setSelected] = useState("");
  const { items, ready } = useCart();
  const [customer,setCustomer] = useState(emptyCustomer);
  const [pricing,setPricing] = useState<Quote>();
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [pending,start] = useTransition();
  const [redirecting,setRedirecting] = useState(false);
  const busy = pending || redirecting;
  const [attempt,setAttempt] = useState("");
  const lines = items.map(({ id,quantity }) => ({ id,quantity }));
  const estimate = items.reduce((total,item) => total+item.quantity*item.price,0);

  useEffect(() => {
    function reset(event: PageTransitionEvent) {
      if (event.persisted) setRedirecting(false);
    }
    window.addEventListener("pageshow",reset);
    return () => window.removeEventListener("pageshow",reset);
  }, []);

  if (!ready) return <p>در حال بارگذاری سبد خرید…</p>;
  if (!items.length) return <EmptyBasket/>;
  function field(name: keyof typeof customer, value: string) {
    setSelected("");
    setCustomer({ ...customer,[name]:value });
    if (name === "province") { setPricing(undefined); setNotice(""); setError(""); }
  }
  function calculate() {
    if (busy || !customer.province) return;
    setError(""); setNotice("");
    start(async () => {
      try {
        const result = await getQuote(lines,customer.province);
        setPricing(result.quote);
        if (result.error) setError(result.error);
      } catch { setError("ارتباط با فروشگاه برقرار نشد. دوباره تلاش کنید."); }
    });
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validateRecipient(event)) return;
    if (!pricing) { calculate(); return; }
    setError(""); setNotice("");
    const key = attempt || crypto.randomUUID();
    setAttempt(key);
    start(async () => {
      try {
        const result = await checkout({ lines,customer,attempt:key,shown:pricing });
        if ("error" in result) { setError(result.error); return; }
        if ("changed" in result) { setPricing(result.changed); setNotice("مبلغ تغییر کرده است. جمع جدید را بررسی کنید و دوباره دکمهٔ پرداخت را بزنید."); return; }
        try { localStorage.setItem(`unishop-paid-${result.orderId}`,JSON.stringify(lines)); } catch { /* Checkout can continue without cart storage. */ }
        window.location.assign(result.url);
        setRedirecting(true);
      } catch { setError("ارتباط با فروشگاه برقرار نشد. دوباره تلاش کنید."); }
    });
  }
  return <form noValidate onSubmit={submit} className="split">
    <fieldset className="panel flow checkout-fields" disabled={busy}>
      <h2>اطلاعات گیرنده</h2>
      {saved.length > 0 && <label>آدرس ذخیره‌شده<select value={selected} onChange={event => {
        const id = event.target.value;
        setSelected(id);
        setCustomer(saved.find(a => a.id === id)?.recipient || emptyCustomer);
        setPricing(undefined); setAttempt(""); setError(""); setNotice("");
      }}><option value="">ورود دستی</option>{saved.map(a => <option key={a.id} value={a.id}>{a.recipient.name} · {a.recipient.city}، {a.recipient.address}</option>)}</select></label>}
      <div className="form-grid">
        <label><span>نام و نام خانوادگی <span aria-hidden="true">*</span></span><input required name="name" autoComplete="name" minLength={2} value={customer.name} onChange={(event) => field("name",event.target.value)}/></label>
        <label><span>شمارهٔ موبایل <span aria-hidden="true">*</span></span><input required name="mobile" inputMode="numeric" autoComplete="tel" dir="ltr" value={customer.mobile} onChange={(event) => field("mobile",digits(event.target.value))}/></label>
        <label><span>استان <span aria-hidden="true">*</span></span><select required name="province" value={customer.province} onChange={(event) => field("province",event.target.value)}>
          <option value="">انتخاب استان</option>{provinces.map((province) => <option key={province}>{province}</option>)}</select></label>
        <label><span>شهر <span aria-hidden="true">*</span></span><input required name="city" autoComplete="address-level2" minLength={2} value={customer.city} onChange={(event) => field("city",event.target.value)}/></label>
        <label><span>کد پستی <span aria-hidden="true">*</span></span><input required name="postalCode" dir="ltr" inputMode="numeric" autoComplete="postal-code" value={customer.postalCode} onChange={(event) => field("postalCode",digits(event.target.value))}/></label>
      </div>
      <label><span>نشانی کامل <span aria-hidden="true">*</span></span><textarea required name="address" autoComplete="street-address" minLength={8} value={customer.address} onChange={(event) => field("address",event.target.value)}/></label>
    </fieldset>
    <aside className="panel flow summary"><h2>صورتحساب</h2>
      <p><span>جمع کالاها</span><strong>{money(pricing?.subtotal ?? estimate)}</strong></p>
      <p><span>هزینهٔ ارسال</span><strong>{pricing ? money(pricing.shipping) : "پس از محاسبه"}</strong></p>
      {pricing && <p className="total"><span>مبلغ پرداخت</span><strong>{money(pricing.total)}</strong></p>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {!pricing ? <PendingButton type="button" className="button primary" disabled={!customer.province} busy={busy}
        pendingLabel="در حال محاسبهٔ ارسال…" onClick={calculate}>محاسبهٔ ارسال</PendingButton>
        : <PendingButton className="button primary" busy={busy} type="submit" pendingLabel="در حال اتصال به درگاه…">
          تأیید و پرداخت <ArrowLeft size={17}/>
        </PendingButton>}
    </aside>
  </form>;
}

export function ClearPaidCart({ orderId }: { orderId: string }) {
  const { ready,consume } = useCart();
  useEffect(() => {
    if (!ready) return;
    const key = `unishop-paid-${orderId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    localStorage.removeItem(key);
    try { consume(JSON.parse(saved)); } catch { /* The saved cart may no longer exist. */ }
  },[ready,orderId,consume]);
  return null;
}
