import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTracking } from "@/app/profile-actions";
import { retryPayment } from "@/app/actions";
import { order } from "@/lib/checkout";
import { fa,money,paymentLabels } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const item = await order((await params).id);
  if (!item) notFound();
  const { customer, quote } = item;
  return <div className="flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/admin/orders">سفارش‌ها</Link><span>جزئیات</span></nav>
    <header className="section-head"><h1>سفارش <bdi>{item.id.slice(0,8)}</bdi></h1><span className={`badge ${item.status}`}>{paymentLabels[item.status]}</span></header>
    <div className="form-grid">
      <section className="panel flow"><h2>اطلاعات گیرنده</h2><p>{customer.name} · <bdi>{customer.mobile}</bdi></p>
        <p>{customer.province}، {customer.city}، {customer.address}</p><p>کد پستی <bdi>{customer.postalCode}</bdi></p></section>
      <section className="panel flow"><h2>پرداخت</h2><p>{item.message || paymentLabels[item.status]}</p>
        <p>درگاه {item.mode === "live" ? "زرین‌پال واقعی" : item.mode === "sandbox" ? "زرین‌پال آزمایشی" : "شبیه‌ساز محلی"}</p>
        {item.reference && <p>شمارهٔ پیگیری <bdi>{item.reference}</bdi></p>}
        {(item.status === "review" || item.status === "pending") && <form action={retryPayment.bind(null,item.id)}>
          <button className="button">بررسی دوبارهٔ پرداخت</button></form>}
      </section>
    </div>
    {item.status === "paid" && <form className="panel flow" action={updateTracking.bind(null,item.id)}>
      <label>کد رهگیری مرسوله<input name="tracking" dir="ltr" maxLength={80} defaultValue={item.tracking_code || ""}/></label>
      <button className="button">ذخیرهٔ وضعیت ارسال</button>
    </form>}
    <section className="panel flow table-wrap"><h2>اقلام سفارش</h2>
      <table><thead><tr><th>کالا</th><th>ترکیب</th><th>تعداد</th><th>قیمت واحد</th></tr></thead>
        <tbody>{quote.items.map((line) => <tr key={line.id}><td>{line.title}</td><td>{line.variant || "—"}</td>
          <td>{fa(line.quantity)}</td><td>{money(line.price)}</td></tr>)}</tbody></table>
      <p>جمع کالاها {money(quote.subtotal)} · ارسال {money(quote.shipping)}</p><strong>مبلغ نهایی {money(quote.total)}</strong>
    </section>
  </div>;
}