import { discountPercent, effectivePrice } from "@/lib/product-pricing";
import { money, type Offer } from "@/lib/shared";

const percentFormat = new Intl.NumberFormat("fa-IR", { style:"percent", maximumFractionDigits:2 });
const precisePercentFormat = new Intl.NumberFormat("fa-IR", { style:"percent", maximumFractionDigits:7 });

export function ProductPrice({ offer, from, empty = "ناموجود" }: {
  offer?: Pick<Offer, "price" | "salePrice">; from?: boolean; empty?: string;
}) {
  const percent = offer ? discountPercent(offer) : null;
  const format = percent !== null && (percent < 0.01 || percent > 99.99) ? precisePercentFormat : percentFormat;
  return <div className="product-price">
    {offer && percent !== null && <div className="product-price-discount">
      <del>{money(offer.price)}</del>
      <span className="product-discount-badge">{format.format(percent / 100)} تخفیف</span>
    </div>}
    <strong>{offer ? `${from ? "از " : ""}${money(effectivePrice(offer))}` : empty}</strong>
  </div>;
}
