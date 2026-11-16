import { notFound, redirect } from "next/navigation";
import { order } from "@/lib/checkout";
import { receiptPath, verify } from "@/lib/payment";
import { money } from "@/lib/shared";

export default async function Simulator({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const item = order(id);
  if (!item || item.mode !== "simulator" || item.secret !== token || !item.authority) notFound();
  if (item.status !== "pending" && item.status !== "review") redirect(receiptPath(item));
  async function submit(data: FormData) {
    "use server";
    const current = order(id);
    if (!current || current.mode !== "simulator" || current.secret !== token || !current.authority) notFound();
    const status = data.get("status");
    if (status !== "OK" && status !== "NOK" && status !== "timeout") notFound();
    const result = await verify(current,status);
    redirect(receiptPath(result));
  }
  return <main className="wrap narrow flow"><section className="panel flow">
    <h1>شبیه‌ساز درگاه پرداخت</h1>
    <p>مبلغ سفارش {money(item.quote.total)}</p>
    <form action={submit} className="flow">
      <button name="status" value="OK" className="button primary">پرداخت موفق</button>
      <button name="status" value="NOK" className="button">لغو پرداخت</button>
      <button name="status" value="timeout" className="button">شبیه‌سازی قطع ارتباط</button>
    </form>
  </section></main>;
}