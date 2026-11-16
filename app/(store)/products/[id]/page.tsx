import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPicker } from "@/components/store-interactions";
import { categories,product } from "@/lib/catalog";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const item = product((await params).id,true);
  if (!item) notFound();
  const category = categories().find((group) => group.id === item.categoryId);
  const offers = item.offers.filter((offer) => offer.active).map((offer) => ({
    ...offer, stock: offer.stock-offer.reserved, reserved: 0, sku: "",
  }));
  return <main className="wrap interior flow">
    <nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/">فروشگاه</Link>{category && <Link href={`/?category=${category.id}#products`}>{category.name}</Link>}<span>{item.title}</span></nav>
    <ProductPicker product={{ ...item, offers }}/>
  </main>;
}