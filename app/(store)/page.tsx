import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, Headphones, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { ProductImage } from "@/components/store-interactions";
import { categories,products } from "@/lib/catalog";
import { money } from "@/lib/shared";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category = "" } = await searchParams;
  const groups = categories();
  const items = products(true,category);
  const featured = items.find((item) => item.id === "demo-headphones" && item.image === "/demo/headphones.jpg");
  return <main className="wrap shop-main">
    {!category && <section className={`hero ${featured ? "" : "hero-no-photo"}`}>
      <div className="hero-copy">
        <span className="hero-label"><span/> فروشگاه آنلاین یونی‌شاپ</span>
        <h1>خرید برای<br/> زندگی هر روز<span>.</span></h1>
        <p>از لوازم دیجیتال تا پوشاک و اکسسوری،<br className="desktop-break"/> کالاهای روزمره‌ات را اینجا پیدا کن.</p>
        <Link className="button hero-button" href="/#products">دیدن محصولات <ArrowDownLeft size={18}/></Link>
      </div>
      {featured && <Link className="hero-photo" href={`/products/${featured.id}`}>
        <img src={featured.image} alt={featured.title} fetchPriority="high"/>
        <span className="hero-photo-link"><Headphones size={17}/> {featured.title} <ArrowLeft size={16}/></span>
      </Link>}
    </section>}
    <section className="benefits" aria-label="امکانات فروشگاه">
      <div><Truck size={23}/><span>محاسبهٔ هزینهٔ ارسال</span></div>
      <div><ShieldCheck size={23}/><span>پرداخت با زرین‌پال</span></div>
      <div><PackageCheck size={23}/><span>ثبت سفارش بدون حساب</span></div>
    </section>
    <section id="products" className="catalog">
      <div className="section-head"><div><h2>{groups.find((group) => group.id === category)?.name || "محصولات فروشگاه"}</h2><p>کالاهای منتشرشدهٔ یونی‌شاپ</p></div>
        <div className="filter" aria-label="دسته‌بندی محصولات">
          <Link href="/#products" className={!category ? "selected" : ""}>همه</Link>
          {groups.map((group) => <Link className={category === group.id ? "selected" : ""} key={group.id}
            href={`/?category=${group.id}#products`}>{group.name}</Link>)}
        </div>
      </div>
      {items.length ? <div className="product-grid">{items.map((item) => {
        const offers = item.offers.filter((offer) => offer.active);
        const available = offers.some((offer) => offer.stock > offer.reserved);
        const prices = offers.map((offer) => offer.price);
        const low = Math.min(...prices);
        const high = Math.max(...prices);
        return <Link className="product-card" key={item.id} href={`/products/${item.id}`}>
          <div className="card-image"><ProductImage src={item.image} title={item.title}/>
            {!available && <span className="product-chip">ناموجود</span>}</div>
          <div className="card-content"><span>{groups.find((group) => group.id === item.categoryId)?.name ?? "کالا"}</span>
            <h3>{item.title}</h3><div className="card-bottom"><strong>{prices.length ? `${low !== high ? "از " : ""}${money(low)}` : "ناموجود"}</strong>
              <span className="card-arrow" aria-hidden><ArrowLeft size={17}/></span></div>
          </div>
        </Link>;
      })}</div> : <p className="panel empty">در این بخش هنوز کالایی منتشر نشده است.</p>}
    </section>
  </main>;
}