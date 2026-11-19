import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { customerLogout } from "@/app/customer-actions";
import { addresses, customerOrders } from "@/lib/profile";
import { AddressForm } from "@/components/address-form";
import { money, paymentLabels, fa } from "@/lib/shared";

export default async function AccountPage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const customer = await currentCustomer();
  if (!customer) redirect("/login");
  const [saved, orders] = await Promise.all([addresses(customer.id), customerOrders(customer.id)]);
  return <main className="wrap interior flow"><section className="panel flow"><h1>حساب کاربری</h1><p>با شمارهٔ <bdi>{customer.mobile}</bdi> وارد شده‌اید.</p><form action={customerLogout}><button className="button">خروج از حساب</button></form></section>
    <section className="panel flow"><h2>سفارش‌های من</h2>
      {!orders.length && <p>هنوز سفارشی با این حساب ثبت نشده است.</p>}
      {orders.map(o => <article className="panel flow" key={o.id}>
        <h3>سفارش <bdi>{o.id.slice(0,8)}</bdi></h3>
        <p>{new Date(Number(o.created)).toLocaleDateString("fa-IR")} · {money(o.quote.total)} · {paymentLabels[o.status]}</p>
        <ul>{o.quote.items.map(i => <li key={i.id}>{i.title} {i.variant} × {fa(i.quantity)}</li>)}</ul>
        {o.status === "paid" && <p>{o.tracking_code ? <>ارسال شده · کد رهگیری <bdi>{o.tracking_code}</bdi></> : "در انتظار ارسال"}</p>}
      </article>)}
    </section>
    <section className="panel flow" id="addresses"><h2>آدرس‌ها و گیرنده‌ها</h2>
      {(await searchParams).error && <p role="alert">{(await searchParams).error}</p>}
      {saved.map(a => <details key={a.id}><summary>{a.recipient.name} · {a.recipient.city}، {a.recipient.address}</summary><AddressForm address={a}/></details>)}
      <details><summary>افزودن آدرس</summary><AddressForm/></details>
    </section></main>;
}
