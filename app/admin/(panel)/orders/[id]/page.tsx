import Link from "next/link";
import { notFound } from "next/navigation";
import { updateFulfillment } from "@/app/profile-actions";
import { cancelAdminOrder, retryPayment } from "@/app/actions";
import { canCancelOrder, order } from "@/lib/checkout";
import { fa, fulfillmentLabels, money, paymentLabels } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";
import { PendingSubmitButton } from "@/components/pending-button";

export default async function OrderDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ fulfillment?: string }>;
}) {
  await requireAdmin();
  const item = await order((await params).id);
  if (!item) notFound();
  const { customer, quote } = item;
  const feedback = (await searchParams).fulfillment;
  const shipped = item.fulfillment_status === "shipped";
  return <div className="flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/admin/orders">سفارش‌ها</Link><span>جزئیات</span></nav>
    <header className="section-head"><h1>سفارش <bdi>{item.id.slice(0,8)}</bdi></h1><span className={`badge ${item.fulfillment_status}`}>{fulfillmentLabels[item.fulfillment_status]}</span></header>
    {feedback === "sms_failed" && <p role="alert">وضعیت سفارش ثبت شد، اما ارسال پیامک موفق نبود.</p>}
    {feedback === "cancellation_unavailable" && <p role="alert">لغو سفارش در وضعیت فعلی امکان‌پذیر نیست.</p>}
    {feedback === "invalid_tracking" && <p role="alert">{shipped ? "کد رهگیری باید بین ۱ تا ۸۰ نویسه باشد." : "کد رهگیری باید بین ۱ تا ۲۵ نویسه باشد."}</p>}
    <div className="form-grid">
      <section className="panel flow"><h2>اطلاعات گیرنده</h2><p>{customer.name} · <bdi>{customer.mobile}</bdi></p>
        <p>{customer.province}، {customer.city}، {customer.address}</p><p>کد پستی <bdi>{customer.postalCode}</bdi></p></section>
      <section className="panel flow"><h2>پرداخت</h2><p>{item.message || paymentLabels[item.status]}</p>
        <p>درگاه {item.mode === "live" ? "زرین‌پال واقعی" : item.mode === "sandbox" ? "زرین‌پال آزمایشی" : "شبیه‌ساز محلی"}</p>
        {item.reference && <p>شمارهٔ پیگیری <bdi>{item.reference}</bdi></p>}
        {(item.status === "review" || item.status === "pending") && <form action={retryPayment.bind(null,item.id)}>
          <PendingSubmitButton className="button" pendingLabel="در حال بررسی پرداخت…">بررسی دوبارهٔ پرداخت</PendingSubmitButton></form>}
        {canCancelOrder(item) && <form action={cancelAdminOrder.bind(null,item.id)}>
          <PendingSubmitButton className="button danger" pendingLabel="در حال لغو…">لغو سفارش</PendingSubmitButton></form>}
      </section>
    </div>
    {item.status === "paid" && item.fulfillment_status === "awaiting_confirmation" && <form className="panel flow" action={updateFulfillment.bind(null,item.id,"confirm")}>
      <PendingSubmitButton className="button" pendingLabel="در حال تأیید سفارش…">تأیید سفارش</PendingSubmitButton>
    </form>}
    {item.status === "paid" && item.fulfillment_status !== "awaiting_confirmation" && <form className="panel flow" action={updateFulfillment.bind(null,item.id,shipped ? "tracking" : "ship")}>
      <label>کد رهگیری مرسوله<input name="tracking" dir="ltr" required maxLength={shipped ? 80 : 25} defaultValue={item.tracking_code || ""}/></label>
      <PendingSubmitButton className="button" pendingLabel={shipped ? "در حال ذخیره…" : "در حال ثبت ارسال…"}>
        {shipped ? "ذخیرهٔ کد رهگیری" : "ثبت ارسال و اطلاع به مشتری"}
      </PendingSubmitButton>
    </form>}
    <section className="panel flow table-wrap"><h2>اقلام سفارش</h2>
      <table><thead><tr><th>کالا</th><th>ترکیب</th><th>تعداد</th><th>قیمت واحد</th></tr></thead>
        <tbody>{quote.items.map((line) => <tr key={line.id}><td>{line.title}</td><td>{line.variant || "—"}</td>
          <td>{fa(line.quantity)}</td><td>{money(line.price)}</td></tr>)}</tbody></table>
      <p>جمع کالاها {money(quote.subtotal)} · ارسال {money(quote.shipping)}</p>
      {quote.discount && <p>تخفیف <bdi>{quote.discount.code}</bdi> · {money(quote.discount.amount)}</p>}
      <strong>مبلغ نهایی {money(quote.total)}</strong>
    </section>
  </div>;
}
