import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { ProductCards } from "@/components/product-cards";
import { categories,product,relatedProducts } from "@/lib/catalog";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const item = await product((await params).id,true);
  if (!item) notFound();
  const [groups,related] = await Promise.all([categories(),relatedProducts(item.id,item.categoryId)]);
  const category = groups.find((group) => group.id === item.categoryId);
  const offers = item.offers.filter((offer) => offer.active).map((offer) => ({
    ...offer, stock: offer.stock-offer.reserved, reserved: 0, sku: "",
  }));
  return <main className="wrap product-page flow">
    <nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/">فروشگاه</Link>
      {category && <Link href={`/?category=${category.id}#products`}>{category.name}</Link>}<span>{item.title}</span>
    </nav>
    <ProductDetail key={item.id} product={{ ...item, offers }} category={category?.name}/>
    {related.length > 0 && <section className="pdp-related" aria-labelledby="related-products">
      <header className="section-head"><h2 id="related-products">کالاهای دیگر فروشگاه</h2><Link href="/#products">مشاهدهٔ همه</Link></header>
      <ProductCards items={related} groups={groups}/>
    </section>}
  </main>;
}