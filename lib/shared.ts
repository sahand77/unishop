export const provinces = [
  "آذربایجان شرقی", "آذربایجان غربی", "اردبیل", "اصفهان", "البرز", "ایلام",
  "بوشهر", "تهران", "چهارمحال و بختیاری", "خراسان جنوبی", "خراسان رضوی",
  "خراسان شمالی", "خوزستان", "زنجان", "سمنان", "سیستان و بلوچستان", "فارس",
  "قزوین", "قم", "کردستان", "کرمان", "کرمانشاه", "کهگیلویه و بویراحمد",
  "گلستان", "گیلان", "لرستان", "مازندران", "مرکزی", "هرمزگان", "همدان", "یزد",
] as const;

export const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
export const money = (value: number) => `${fa(value)} تومان`;
export const selectionKey = (options: Record<string, string>) =>
  JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b, "en")));
export const paymentLabels = {
  pending: "در انتظار پرداخت", review: "در انتظار بررسی", paid: "پرداخت شده",
  canceled: "لغو شده", failed: "ناموفق",
};
export type Attribute = { id: string; name: string; values: { id: string; name: string }[] };
export type Category = { id: string; name: string };
export type Offer = {
  id: string; options: Record<string, string>; price: number; stock: number;
  weight: number; sku: string; image: string; active: boolean; reserved: number;
};
export type Product = {
  id: string; title: string; description: string; categoryId: string;
  kind: "simple" | "variable"; status: "draft" | "published";
  image: string; attributes: Attribute[]; offers: Offer[];
};
export type CartLine = { id: string; quantity: number };
export type Quote = {
  subtotal: number; quantity: number; weight: number; shipping: number; total: number;
  items: { id: string; title: string; variant: string; quantity: number; price: number; image: string }[];
};
export type ShippingRule = {
  id: string; name: string; priority: number; fee: number; provinces: string[]; categories: string[];
  minQuantity: number | null; maxQuantity: number | null; minWeight: number | null;
  maxWeight: number | null; minSubtotal: number | null; maxSubtotal: number | null;
};