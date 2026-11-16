import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductImage } from "@/components/store-interactions";
import { categories,products } from "@/lib/catalog";
import { requireAdmin } from "@/lib/auth";

export default async function AdminProducts() {
  await requireAdmin();
  const list = products();
  const groups = categories();
  return <div className="flow"><header className="section-head"><h1>کالاها</h1><Link className="button primary" href="/admin/products/new"><Plus size={17}/> افزودن کالا</Link></header>
    <div className="panel table-wrap">{list.length ? <table><thead><tr><th>کالا</th><th>نوع</th><th>دسته</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>{list.map((item) => <tr key={item.id}><td><div className="table-product"><ProductImage src={item.image} title={item.title}/><strong>{item.title}</strong></div></td>
        <td>{item.kind === "simple" ? "ساده" : "متغیر"}</td><td>{groups.find((group) => group.id === item.categoryId)?.name || "—"}</td>
        <td><span className={`badge ${item.status === "published" ? "paid" : "pending"}`}>{item.status === "published" ? "منتشر شده" : "پیش‌نویس"}</span></td>
        <td><Link href={`/admin/products/${item.id}`}>ویرایش</Link></td></tr>)}</tbody></table>
      : <p className="muted">هنوز کالایی ایجاد نشده است.</p>}</div></div>;
}