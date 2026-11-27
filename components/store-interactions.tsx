"use client";
import { validateRecipient } from "./validate-recipient";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ImageOff, Minus, Search, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { checkout, getCartAvailability, getQuote } from "@/app/actions";
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
  const offerKey = JSON.stringify([...new Set(items.map(({ id }) => id))].sort());
  const [stock,setStock] = useState<{ key: string; available: Map<string,number> | null }>();
  const [retry,setRetry] = useState(0);

  useEffect(() => {
    const ids: string[] = JSON.parse(offerKey);
    if (!ready || !ids.length) return;
    let cancelled = false;
    let pending = false;

    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const batches = [];
        for (let index = 0; index < ids.length; index += 50) {
          batches.push(getCartAvailability(ids.slice(index,index+50)));
        }
        const offers = (await Promise.all(batches)).flat();
        if (!cancelled) setStock({ key:offerKey,available:new Map(offers.map(({ id,available }) => [id,available])) });
      } catch {
        if (!cancelled) setStock({ key:offerKey,available:null });
      } finally {
        pending = false;
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    void refresh();
    window.addEventListener("focus",refreshIfVisible);
    document.addEventListener("visibilitychange",refreshIfVisible);
    const timer = window.setInterval(refreshIfVisible,30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus",refreshIfVisible);
      document.removeEventListener("visibilitychange",refreshIfVisible);
    };
  },[offerKey,ready,retry]);

  const available = stock?.key === offerKey ? stock.available : undefined;
  const lines = items.map((item) => {
    const limit = Math.min(available?.get(item.id) ?? 0,99);
    return { item,limit,stockIssue:!!available && item.quantity > limit };
  });
  const hasStockIssue = lines.some(({ stockIssue }) => stockIssue);
  const subtotal = items.reduce((sum,item) => sum + item.quantity*item.price,0);
  if (!ready) return <p>در حال بارگذاری سبد خرید…</p>;
  if (!items.length) return <EmptyBasket/>;
  return <div className="split">
    <div className="panel basket">{lines.map(({ item,limit,stockIssue }) => (
      <article key={item.id} className="basket-item" data-stock-issue={stockIssue}>
      <ProductImage className="basket-image" src={item.image} title={item.title}/>
      <div><Link href={`/products/${item.productId}`}><strong>{item.title}</strong></Link>
        {item.variant && <p>{item.variant}</p>}<span>{money(item.price)}</span>
        {stockIssue && <p className="basket-stock-error" role="alert">
          {limit <= 0 ? "این گزینه دیگر موجود نیست. آن را از سبد حذف کنید."
            : `تعداد در سبد ${fa(item.quantity)} است. حداکثر ${fa(limit)} عدد قابل سفارش است.`}
        </p>}
        {available && !stockIssue && item.quantity === limit && <p>حداکثر تعداد قابل سفارش در سبد است.</p>}
      </div>
      <div className="basket-actions"><div className="stepper">
        <button type="button" aria-label="افزایش تعداد" disabled={!available || item.quantity >= limit}
          onClick={() => setQuantity(item.id,item.quantity+1)}><Plus size={16}/></button>
        <span>{fa(item.quantity)}</span>
        <button type="button" aria-label="کاهش تعداد" onClick={() => setQuantity(item.id,item.quantity-1)}><Minus size={16}/></button>
      </div><button className="icon-link" type="button" aria-label="حذف کالا" onClick={() => setQuantity(item.id,0)}><Trash2 size={17}/></button></div>
      </article>
    ))}</div>
    <aside className="panel flow summary"><h2>خلاصهٔ سبد</h2><p><span>جمع کالاها</span><strong>{money(subtotal)}</strong></p>
      {available === undefined && <div role="status">در حال بررسی موجودی کالاها…</div>}
      {available === null && <div className="notice error" role="status">موجودی کالاها بررسی نشد. <button type="button" className="button"
        onClick={() => { setStock(undefined); setRetry((count) => count+1); }}>تلاش دوباره</button></div>}
      {hasStockIssue && <div className="notice error">تعداد کالاهای مشخص‌شده را اصلاح کنید تا بتوانید سفارش را ادامه دهید.</div>}
      {available && !hasStockIssue ? <Link className="button primary" href="/checkout">ادامه و ثبت سفارش <ArrowLeft size={17}/></Link>
        : <button className="button primary" type="button" disabled>ادامه و ثبت سفارش <ArrowLeft size={17}/></button>}
    </aside>
  </div>;
}

function EmptyBasket() {
  return <div className="panel empty flow"><ShoppingBag size={34}/><h2>سبد خرید خالی است</h2>
    <Link href="/#products" className="button primary">دیدن محصولات</Link></div>;
}

const emptyCustomer = { name:"",mobile:"",province:"",city:"",address:"",postalCode:"" };
const checkoutDraftSchema = z.object({
  customer: z.object({ name:z.string(),mobile:z.string(),province:z.string().refine(value => !value || provinces.some(province => province === value)),
    city:z.string(),address:z.string(),postalCode:z.string() }),
  selected: z.string(), revision: z.string(),
});
type CheckoutDraft = z.infer<typeof checkoutDraftSchema>;
const emptyDraft: CheckoutDraft = { customer:emptyCustomer,selected:"",revision:"" };
const checkoutDraftKey = (customerId: string | null) => `unishop-checkout-draft:${customerId ?? "guest"}`;

function readCheckoutDraft(key: string) {
  try {
    const result = checkoutDraftSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
    return result.success ? result.data : undefined;
  } catch { /* An unreadable draft should not block checkout. */ }
}

const digits = (value: string) => value.replace(/[۰-۹]/g,(char) => String(char.charCodeAt(0)-1776))
  .replace(/[٠-٩]/g,(char) => String(char.charCodeAt(0)-1632));

export function CheckoutScreen({ saved, customerId }: { saved: import("@/lib/profile").SavedAddress[]; customerId: string | null }) {
  const { items, ready } = useCart();
  const draftKey = checkoutDraftKey(customerId);
  const [draft,setDraft] = useState<CheckoutDraft>();
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
    setDraft(readCheckoutDraft(draftKey) ?? emptyDraft);
    function reset(event: PageTransitionEvent) {
      if (event.persisted) setRedirecting(false);
    }
    window.addEventListener("pageshow",reset);
    return () => window.removeEventListener("pageshow",reset);
  },[draftKey]);

  if (!ready) return <p>در حال بارگذاری سبد خرید…</p>;
  if (!items.length) return <EmptyBasket/>;
  if (!draft) return <p>در حال بارگذاری فرم سفارش…</p>;
  const { customer } = draft;
  const selected = saved.some((entry) => entry.id === draft.selected) ? draft.selected : "";

  function saveDraft(customer: CheckoutDraft["customer"], selected = "") {
    const next = { customer,selected,revision:crypto.getRandomValues(new Uint32Array(4)).join("-") };
    setDraft(next);
    try { localStorage.setItem(draftKey,JSON.stringify(next)); } catch { /* The form still works without storage. */ }
  }

  function field(name: keyof typeof customer, value: string) {
    saveDraft({ ...customer,[name]:value });
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
    const draftRevision = draft?.revision;
    setAttempt(key);
    start(async () => {
      try {
        const result = await checkout({ lines,customer,attempt:key,shown:pricing });
        if ("error" in result) { setError(result.error); return; }
        if ("changed" in result) { setPricing(result.changed); setNotice("مبلغ تغییر کرده است. جمع جدید را بررسی کنید و دوباره دکمهٔ پرداخت را بزنید."); return; }
        try { localStorage.setItem(`unishop-paid-${result.orderId}`,JSON.stringify({ lines,draftRevision })); } catch { /* Checkout can continue without cart storage. */ }
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
        saveDraft(saved.find(a => a.id === id)?.recipient ?? emptyCustomer,id);
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

export function ClearPaidCart({ orderId, customerId }: { orderId: string; customerId: string | null }) {
  const { ready,consume } = useCart();
  useEffect(() => {
    if (!ready) return;
    const key = `unishop-paid-${orderId}`;
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return;
      localStorage.removeItem(key);
      const receipt = JSON.parse(saved);
      consume(Array.isArray(receipt) ? receipt : receipt.lines);
      const draftKey = checkoutDraftKey(customerId);
      if (receipt.draftRevision && readCheckoutDraft(draftKey)?.revision === receipt.draftRevision) {
        localStorage.removeItem(draftKey);
      }
    } catch { /* The saved cart or draft may no longer exist. */ }
  },[ready,orderId,customerId,consume]);
  return null;
}
