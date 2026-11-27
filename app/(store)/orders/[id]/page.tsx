import { CustomerPayment } from "@/components/customer-payment";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearPaidCart } from "@/components/store-interactions";
import { order } from "@/lib/checkout";
import { money,customerPaymentLabels,fulfillmentLabels } from "@/lib/shared";

export default async function Receipt({ params,searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }>;
}) {
  const item = await order((await params).id);
  if (!item || item.secret !== (await searchParams).token) notFound();
  return <main className="wrap narrow interior flow"><section className="panel flow">
    {item.status === "paid" && <ClearPaidCart orderId={item.id} customerId={item.customer_id}/>}
    <h1>نتیجهٔ سفارش</h1><span className={`badge ${item.status}`}>{customerPaymentLabels[item.status]}</span>
    <p>{fulfillmentLabels[item.fulfillment_status]}{item.tracking_code && <> · کد رهگیری <bdi>{item.tracking_code}</bdi></>}</p>
    {item.message && <p>{item.message}</p>}
    <p>شمارهٔ سفارش <bdi>{item.id.slice(0,8)}</bdi></p>
    {item.quote.discount && <p>تخفیف <bdi>{item.quote.discount.code}</bdi> · {money(item.quote.discount.amount)}</p>}
    <p>مبلغ پرداخت {money(item.quote.total)}</p>
    {item.reference && <p>شمارهٔ پیگیری <bdi>{item.reference}</bdi></p>}
    {item.status !== "paid" && item.fulfillment_status !== "canceled" && <CustomerPayment id={item.id} token={item.secret}/>}
    <Link className="button" href={item.status === "failed" || item.status === "canceled" ? "/cart" : "/"}>{item.status === "failed" || item.status === "canceled" ? "بازگشت به سبد" : "بازگشت به فروشگاه"}</Link>
  </section></main>;
}
