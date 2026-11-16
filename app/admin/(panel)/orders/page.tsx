import Link from "next/link";
import { orders } from "@/lib/checkout";
import { money,paymentLabels } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";

export default async function Orders() {
  await requireAdmin();
  const list = await orders();
  return <div className="flow"><h1>سفارش‌ها</h1><div className="panel table-wrap">
    {list.length ? <table><thead><tr><th>شماره</th><th>گیرنده</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>{list.map((item) => <tr key={item.id}><td><bdi>{item.id.slice(0,8)}</bdi></td><td>{item.customer.name}</td>
        <td>{money(item.quote.total)}</td><td><span className={`badge ${item.status}`}>{paymentLabels[item.status]}</span></td>
        <td><Link href={`/admin/orders/${item.id}`}>جزئیات</Link></td></tr>)}</tbody></table>
      : <p className="muted">هنوز سفارشی ثبت نشده است.</p>}</div></div>;
}