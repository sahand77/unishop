import { cache } from "react";
import { publicUrl } from "@/lib/public-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { ProductCards } from "@/components/product-cards";
import { categories,product,relatedProducts,variationName } from "@/lib/catalog";

type PageProps = { params: Promise<{ id: string }> };
const publishedProduct = cache(async (id: string) => {
  const item = await product(id,true);
  if (!item) notFound();
  return item;
});

export async function generateMetadata({ params }: PageProps) {
  const item = await publishedProduct((await params).id);
  const description = item.description.trim().replace(/\s+/g," ");
  return {
    title: item.title,
    alternates: { canonical: publicUrl(`/products/${encodeURIComponent(item.id)}`) },
    description: description.length > 180
      ? description.slice(0,180).replace(/\s+\S*$/,"") + "…"
      : description || `مشخصات، قیمت و موجودی ${item.title} در یونی‌شاپ.`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const item = await publishedProduct((await params).id);
  const [groups,related] = await Promise.all([categories(),relatedProducts(item.id,item.categoryId)]);
  const category = groups.find((group) => group.id === item.categoryId);
  const offers = item.offers.filter((offer) => offer.active).map((offer) => ({
    ...offer, stock: offer.stock-offer.reserved, reserved: 0, sku: "",
  }));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: item.description || undefined,
    image: item.image || undefined,
    offers: offers.map(offer => ({
      "@type": "Offer",
      name: [item.title, variationName(item.attributes, offer.options)].filter(Boolean).join(" - "),
      price: offer.price * 10,
      priceCurrency: "IRR",
      availability: offer.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  };
  return <main className="wrap product-page flow">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g,"\\u003c") }}/>
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