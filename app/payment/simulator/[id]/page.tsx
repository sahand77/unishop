import { notFound, redirect } from "next/navigation";
import { order } from "@/lib/checkout";
import { receiptPath, verify } from "@/lib/payment";
import { money } from "@/lib/shared";
import { PendingSubmitButton } from "@/components/pending-button";

export default async function Simulator({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const item = await order(id);
  if (!item || item.mode !== "simulator" || item.secret !== token || !item.authority) notFound();
  if (item.status !== "pending" && item.status !== "review") redirect(receiptPath(item));
  const authority = item.authority;
  async function submit(data: FormData) {
    "use server";
    const current = await order(id);
    if (!current || current.mode !== "simulator" || current.secret !== token || current.authority !== authority) notFound();
    const status = data.get("status");
    if (status !== "OK" && status !== "NOK" && status !== "timeout") notFound();
    const result = await verify(current,status);
    redirect(receiptPath(result));
  }
  return <main className="wrap narrow flow"><section className="panel flow">
    <h1>شبیه‌ساز درگاه پرداخت</h1>
    <p>مبلغ سفارش {money(item.quote.total)}</p>
    <form action={submit} className="flow">
      <PendingSubmitButton name="status" value="OK" className="button primary" pendingLabel="در حال ثبت پرداخت…">پرداخت موفق</PendingSubmitButton>
      <PendingSubmitButton name="status" value="NOK" className="button" pendingLabel="در حال لغو…">لغو پرداخت</PendingSubmitButton>
      <PendingSubmitButton name="status" value="timeout" className="button" pendingLabel="در حال شبیه‌سازی…">شبیه‌سازی قطع ارتباط</PendingSubmitButton>
    </form>
  </section></main>;
}
