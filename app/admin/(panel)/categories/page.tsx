import { CategoryForm } from "@/components/admin-forms";
import { categories } from "@/lib/catalog";
import { requireAdmin } from "@/lib/auth";

export default async function Categories() {
  await requireAdmin();
  const groups = await categories();
  return <div className="flow"><h1>دسته‌بندی‌ها</h1><div className="split admin-split">
    <section className="panel flow"><h2>دسته‌های فروشگاه</h2>{groups.length ? groups.map((item) => <details className="variant" key={item.id}>
      <summary>{item.name}</summary><CategoryForm category={item}/></details>) : <p className="muted">هنوز دسته‌ای تعریف نشده است.</p>}</section>
    <section className="panel flow"><h2>افزودن دسته</h2><CategoryForm/></section>
  </div></div>;
}