import { cache } from "react";
import { notFound } from "next/navigation";
import { publicUrl } from "@/lib/public-url";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, PackageCheck, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { ProductCards } from "@/components/product-cards";
import { ProductPagination } from "@/components/product-pagination";
import { categories,featuredProduct,parseProductPage,productPage } from "@/lib/catalog";
import { storeName } from "@/lib/store-settings";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ category?: string | string[]; q?: string | string[]; page?: string | string[] }> };
const loadItems = cache(async (page: number, category: string, search: string) => {
  const result = await productPage(page,true,category,search);
  if (page > 1 && !result.items.length) notFound();
  return result;
});
const loadCategories = cache(categories);

function catalogUrl(category: string, search: string, page = 1) {
  const query = new URLSearchParams();
  if (category) query.set("category",category);
  if (search) query.set("q",search);
  if (page > 1) query.set("page",String(page));
  return query.size ? `/?${query}` : "/";
}

async function catalogContext({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : "";
  const search = typeof params.q === "string" ? params.q.trim().slice(0,100) : "";
  const groups = await loadCategories();
  const group = groups.find(group => group.id === category);
  if (category && !group) notFound();
  return { category, search, page: parseProductPage(params.page), groups, group };
}

export async function generateMetadata(props: PageProps) {
  const { category, search, page, group } = await catalogContext(props);
  if (page > 1) await loadItems(page,category,search);
  if (search) return { robots: { index: false }, title: `نتایج جست‌وجوی «${search}»` };
  const alternates = { canonical: publicUrl(catalogUrl(category,search,page)) };
  if (!group) return { alternates };
  const { items } = await loadItems(page,category,search);
  return { alternates,
    robots: items.length ? undefined : { index: false }, title: group.name, description: `مشاهدهٔ کالاهای دستهٔ ${group.name} و مقایسهٔ مشخصات و قیمت آن‌ها در ${await storeName()}.` };
}

export default async function Home(props: PageProps) {
  const { category, search, page, groups, group } = await catalogContext(props);
  const showIntro = !category && !search && page === 1;
  const [{ items, hasNext },featured] = await Promise.all([
    loadItems(page,category,search),
    showIntro ? featuredProduct() : undefined,
  ]);
  const Heading = showIntro ? "h2" : "h1";
  return <main className="wrap shop-main">
    {showIntro && <section className={`hero ${featured ? "" : "hero-no-photo"}`}>
      <div className="hero-copy">
        <span className="hero-label"><span className="hero-label-dot"/><span>فروشگاه آنلاین <bdi>{await storeName()}</bdi></span></span>
        <h1>خرید برای<br/> زندگی هر روز<span>.</span></h1>
        <p>محصولات فروشگاه را ببین و گزینهٔ دلخواهت را انتخاب کن.</p>
        <Link className="button hero-button" href="/#products">دیدن محصولات <ArrowDownLeft size={18}/></Link>
      </div>
      {featured && <Link className="hero-photo" href={`/products/${featured.id}`}>
        <img src={featured.image} alt={featured.title} fetchPriority="high"/>
        <span className="hero-photo-link"><ShoppingBag size={17}/> {featured.title} <ArrowLeft size={16}/></span>
      </Link>}
    </section>}
    {showIntro && <section className="benefits" aria-label="امکانات فروشگاه">
      <div><Truck size={23}/><span>محاسبهٔ هزینهٔ ارسال</span></div>
      <div><ShieldCheck size={23}/><span>پرداخت با زرین‌پال</span></div>
      <div><PackageCheck size={23}/><span>ثبت سفارش بدون حساب</span></div>
    </section>}
    <section id="products" className="catalog">
      <div className="section-head"><div><Heading>{search ? `نتایج جست‌وجوی «${search}»` : group?.name || "محصولات فروشگاه"}</Heading></div>
        <div className="filter" aria-label="دسته‌بندی محصولات">
          <Link href={`${catalogUrl("",search)}#products`} className={!category ? "selected" : ""}>همه</Link>
          {groups.map((group) => <Link className={category === group.id ? "selected" : ""} key={group.id}
            href={`${catalogUrl(group.id,search)}#products`}>{group.name}</Link>)}
        </div>
      </div>
      {items.length ? <ProductCards items={items} groups={groups}/> : <p className="panel empty">
        {search ? "کالایی برای این جست‌وجو پیدا نشد." : "در این بخش هنوز کالایی منتشر نشده است."}
      </p>}
      <ProductPagination page={page} hasNext={hasNext} href={(target) => `${catalogUrl(category,search,target)}#products`}/>
    </section>
  </main>;
}
