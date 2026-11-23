import Link from "next/link";
import { Boxes, ClipboardList, FolderTree, Plus } from "lucide-react";
import { categories,productCount } from "@/lib/catalog";
import { orders } from "@/lib/checkout";
import { fa,fulfillmentLabels,money } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";

export default async function Dashboard() {
  await requireAdmin();
  const [list,totalProducts,groups] = await Promise.all([orders(),productCount(),categories()]);
  return <div className="flow">
    <header className="section-head"><h1>پیشخوان</h1><Link className="button primary" href="/admin/products/new"><Plus size={17}/> افزودن کالا</Link></header>
    <div className="metrics">{[
      { title:"کالاها",value:totalProducts,href:"/admin/products",icon:Boxes },
      { title:"دسته‌بندی‌ها",value:groups.length,href:"/admin/categories",icon:FolderTree },
      { title:"سفارش‌ها",value:list.length,href:"/admin/orders",icon:ClipboardList },
    ].map(({ title,value,href,icon:Icon }) => <Link href={href} key={href} className="panel metric"><Icon size={23}/><span>{title}</span><strong>{fa(value)}</strong></Link>)}</div>
    <section className="panel flow"><div className="section-head"><h2>سفارش‌های اخیر</h2><Link href="/admin/orders">همهٔ سفارش‌ها</Link></div>
      {list.length ? <div className="list">{list.slice(0,5).map((item) => <Link key={item.id} href={`/admin/orders/${item.id}`}>
        <span>{item.customer.name}</span><span>{money(item.quote.total)}</span><span className={`badge ${item.fulfillment_status}`}>{fulfillmentLabels[item.fulfillment_status]}</span></Link>)}</div>
        : <p className="muted">هنوز سفارشی ثبت نشده است.</p>}
    </section>
  </div>;
}
