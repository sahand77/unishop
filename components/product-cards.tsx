import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { money, type Category, type Product } from "@/lib/shared";
import { ProductImage } from "./store-interactions";

export function ProductCards({ items, groups }: { items: Product[]; groups: Category[] }) {
  return <div className="product-grid">{items.map((item) => {
    const offers = item.offers.filter((offer) => offer.active);
    const available = offers.some((offer) => offer.stock > offer.reserved);
    const prices = offers.map((offer) => offer.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    return <Link className="product-card" key={item.id} href={`/products/${item.id}`}>
      <div className="card-image"><ProductImage src={item.image || offers.find((offer) => offer.image)?.image || ""} title=""/>
        {!available && <span className="product-chip">ناموجود</span>}</div>
      <div className="card-content"><span>{groups.find((group) => group.id === item.categoryId)?.name ?? "کالا"}</span>
        <h3>{item.title}</h3><div className="card-bottom"><strong>{prices.length ? `${low !== high ? "از " : ""}${money(low)}` : "ناموجود"}</strong>
          <span className="card-arrow" aria-hidden><ArrowLeft size={17}/></span></div>
      </div>
    </Link>;
  })}</div>;
}