import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin-forms";
import { categories,product } from "@/lib/catalog";
import { requireAdmin } from "@/lib/auth";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const item = id === "new" ? undefined : await product(id);
  if (id !== "new" && !item) notFound();
  return <div className="flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/admin/products">کالاها</Link><span>{item ? "ویرایش کالا" : "کالای جدید"}</span></nav>
    <h1>{item?.title || "افزودن کالا"}</h1><ProductForm key={id} initial={item} categories={await categories()}/></div>;
}