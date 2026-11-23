import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ProductPagination } from "@/components/product-pagination";
import { ProductImage } from "@/components/store-interactions";
import { categories,parseProductPage,productPage } from "@/lib/catalog";
import { categoryOptions } from "@/lib/category-tree";
import { requireAdmin } from "@/lib/auth";

export default async function AdminProducts({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireAdmin();
  const page = parseProductPage((await searchParams).page);
  const [{ items: list, hasNext },groups] = await Promise.all([productPage(page),categories()]);
  if (page > 1 && !list.length) notFound();
  const labels = new Map(categoryOptions(groups).map(item => [item.id,item.label]));
  return <div className="flow"><header className="section-head"><h1>کالاها</h1><Link className="button primary" href="/admin/products/new"><Plus size={17}/> افزودن کالا</Link></header>
    <div className="panel table-wrap">{list.length ? <table><thead><tr><th>کالا</th><th>نوع</th><th>دسته</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>{list.map((item) => <tr key={item.id}><td><div className="table-product"><ProductImage src={item.image} title={item.title}/><strong>{item.title}</strong></div></td>
        <td>{item.kind === "simple" ? "ساده" : "متغیر"}</td><td>{labels.get(item.categoryId) || "—"}</td>
        <td><span className={`badge ${item.status === "published" ? "paid" : "pending"}`}>{item.status === "published" ? "منتشر شده" : "پیش‌نویس"}</span></td>
        <td><Link href={`/admin/products/${item.id}`}>ویرایش</Link></td></tr>)}</tbody></table>
      : <p className="muted">هنوز کالایی ایجاد نشده است.</p>}</div>
    <ProductPagination page={page} hasNext={hasNext} href={(target) => target === 1 ? "/admin/products" : `/admin/products?page=${target}`}/>
  </div>;
}
