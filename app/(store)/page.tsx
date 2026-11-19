import { cache } from "react";
import { notFound } from "next/navigation";
import { publicUrl } from "@/lib/public-url";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, PackageCheck, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { ProductCards } from "@/components/product-cards";
import { categories,products } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ category?: string | string[]; q?: string | string[] }> };
const loadItems = cache((category: string, search: string) => products(true,category,search));
const loadCategories = cache(categories);

async function catalogContext({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : "";
  const search = typeof params.q === "string" ? params.q.trim().slice(0,100) : "";
  const groups = await loadCategories();
  const group = groups.find(group => group.id === category);
  if (category && !group) notFound();
  return { category, search, groups, group };
}

export async function generateMetadata(props: PageProps) {
  const { category, search, group } = await catalogContext(props);
  if (search) return { robots: { index: false }, title: `نتایج جست‌وجوی «${search}»` };
  if (!group) return { alternates: { canonical: publicUrl("/") } };
  const items = await loadItems(category,search);
  return { alternates: { canonical: publicUrl(`/?category=${encodeURIComponent(category)}`) },
    robots: items.length ? undefined : { index: false }, title: group.name, description: `مشاهدهٔ کالاهای دستهٔ ${group.name} و مقایسهٔ مشخصات و قیمت آن‌ها در یونی‌شاپ.` };
}

export default async function Home(props: PageProps) {
  const { category, search, groups } = await catalogContext(props);
  const items = await loadItems(category,search);
  const Heading = category || search ? "h1" : "h2";
  function filterLink(id: string) {
    const query = new URLSearchParams();
    if (id) query.set("category",id);
    if (search) query.set("q",search);
    return query.size ? `/?${query}#products` : "/#products";
  }
  const featured = items.find((item) => item.id === "demo-sadena-67111427" && item.image) ?? items.find((item) => item.image);
  return <main className="wrap shop-main">
    {!category && !search && <section className={`hero ${featured ? "" : "hero-no-photo"}`}>
      <div className="hero-copy">
        <span className="hero-label"><span/> فروشگاه آنلاین یونی‌شاپ</span>
        <h1>خرید برای<br/> زندگی هر روز<span>.</span></h1>
        <p>محصولات فروشگاه را ببین و گزینهٔ دلخواهت را انتخاب کن.</p>
        <Link className="button hero-button" href="/#products">دیدن محصولات <ArrowDownLeft size={18}/></Link>
      </div>
      {featured && <Link className="hero-photo" href={`/products/${featured.id}`}>
        <img src={featured.image} alt={featured.title} fetchPriority="high"/>
        <span className="hero-photo-link"><ShoppingBag size={17}/> {featured.title} <ArrowLeft size={16}/></span>
      </Link>}
    </section>}
    {!category && !search && <section className="benefits" aria-label="امکانات فروشگاه">
      <div><Truck size={23}/><span>محاسبهٔ هزینهٔ ارسال</span></div>
      <div><ShieldCheck size={23}/><span>پرداخت با زرین‌پال</span></div>
      <div><PackageCheck size={23}/><span>ثبت سفارش بدون حساب</span></div>
    </section>}
    <section id="products" className="catalog">
      <div className="section-head"><div><Heading>{search ? `نتایج جست‌وجوی «${search}»` : groups.find((group) => group.id === category)?.name || "محصولات فروشگاه"}</Heading></div>
        <div className="filter" aria-label="دسته‌بندی محصولات">
          <Link href={filterLink("")} className={!category ? "selected" : ""}>همه</Link>
          {groups.map((group) => <Link className={category === group.id ? "selected" : ""} key={group.id}
            href={filterLink(group.id)}>{group.name}</Link>)}
        </div>
      </div>
      {items.length ? <ProductCards items={items} groups={groups}/> : <p className="panel empty">
        {search ? "کالایی برای این جست‌وجو پیدا نشد." : "در این بخش هنوز کالایی منتشر نشده است."}
      </p>}
    </section>
  </main>;
}
