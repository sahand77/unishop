import type { Offer } from "./shared";

type OfferPrice = Pick<Offer, "price" | "salePrice">;

export function effectivePrice({ price, salePrice }: OfferPrice) {
  return salePrice ?? price;
}

export function discountPercent({ price, salePrice }: OfferPrice) {
  return salePrice !== null && salePrice > 0 && salePrice < price
    ? (price - salePrice) * 100 / price
    : null;
}

export function startingPrice(offers: OfferPrice[]) {
  let offer: OfferPrice | undefined;
  let from = false;
  for (const candidate of offers) {
    if (!offer) {
      offer = candidate;
      continue;
    }
    const comparison = effectivePrice(candidate) - effectivePrice(offer);
    if (comparison !== 0) from = true;
    if (comparison < 0 || (comparison === 0 && offer.salePrice === null && candidate.salePrice !== null)) {
      offer = candidate;
    }
  }
  return { offer, from };
}
