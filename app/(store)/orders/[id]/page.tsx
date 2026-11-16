import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearPaidCart } from "@/components/store-interactions";
import { order } from "@/lib/checkout";
import { gatewayLink } from "@/lib/payment";
import { money,paymentLabels } from "@/lib/shared";

export default async function Receipt({ params,searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }>;
}) {
  const item = await order((await params).id);
  if (!item || item.secret !== (await searchParams).token) notFound();
  const awaiting = item.status === "pending" || item.status === "review";
  return <main className="wrap narrow interior flow"><section className="panel flow">
    {item.status === "paid" && <ClearPaidCart orderId={item.id}/>}
    <h1>نتیجهٔ سفارش</h1><span className={`badge ${item.status}`}>{paymentLabels[item.status]}</span>
    {item.message && <p>{item.message}</p>}
    <p>شمارهٔ سفارش <bdi>{item.id.slice(0,8)}</bdi></p><p>مبلغ پرداخت {money(item.quote.total)}</p>
    {item.reference && <p>شمارهٔ پیگیری <bdi>{item.reference}</bdi></p>}
    {awaiting && item.authority && <a className="button primary" href={gatewayLink(item)}>بازگشت به درگاه</a>}
    <Link className="button" href={item.status === "failed" || item.status === "canceled" ? "/cart" : "/"}>{item.status === "failed" || item.status === "canceled" ? "بازگشت به سبد" : "بازگشت به فروشگاه"}</Link>
  </section></main>;
}