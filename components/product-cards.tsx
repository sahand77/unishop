import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { startingPrice } from "@/lib/product-pricing";
import type { Category, Product } from "@/lib/shared";
import { ProductPrice } from "./product-price";
import { ProductImage } from "./store-interactions";

export function ProductCards({ items, groups }: { items: Product[]; groups: Category[] }) {
  return <div className="product-grid">{items.map((item) => {
    const offers = item.offers.filter((offer) => offer.active);
    const available = offers.some((offer) => offer.stock > offer.reserved);
    const { offer, from } = startingPrice(offers);
    return <Link className="product-card" key={item.id} href={`/products/${item.id}`}>
      <div className="card-image"><ProductImage src={item.image || offers.find((offer) => offer.image && !item.gallery.some(entry => entry.kind === "video" && entry.url === offer.image))?.image || ""} title=""/>
        {!available && <span className="product-chip">ناموجود</span>}</div>
      <div className="card-content"><span>{groups.find((group) => group.id === item.categoryId)?.name ?? "کالا"}</span>
        <h3>{item.title}</h3><div className="card-bottom"><ProductPrice offer={offer} from={from}/>
          <span className="card-arrow" aria-hidden><ArrowLeft size={17}/></span></div>
      </div>
    </Link>;
  })}</div>;
}
