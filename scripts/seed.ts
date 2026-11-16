import { randomUUID } from "node:crypto";
import { categories, saveCategory, saveProduct } from "../lib/catalog";
import { rules, saveRule } from "../lib/shipping";
import type { Offer } from "../lib/shared";
import { closeDb } from "../lib/db";

const catalog = [
  { id: "demo-headphones", title: "هدفون بی‌سیم استودیو", category: "دیجیتال", image: "headphones", price: 2890000, weight: 320,
    description: "هدفون بی‌سیم دورگوشی برای شنیدن موسیقی، پادکست و تماس‌های روزمره. پدهای نرم و هدبند قابل تنظیم به استفادهٔ راحت‌تر کمک می‌کنند." },
  { id: "demo-shoes", title: "کتانی روزمرهٔ رانر", category: "پوشاک", image: "shoes", price: 2350000, weight: 680,
    description: "کتانی سبک برای پیاده‌روی و استفادهٔ روزانه. سایز و رنگ دلخواه را از میان ترکیب‌های موجود انتخاب کنید." },
  { id: "demo-watch", title: "ساعت مچی کلاسیک", category: "اکسسوری", image: "watch", price: 1680000, weight: 180,
    description: "ساعت مچی با صفحهٔ ساده و بند نرم. طراحی خلوت و خوانا برای استفادهٔ هر روز." },
  { id: "demo-bag", title: "کوله‌پشتی شهری", category: "لوازم روزمره", image: "bag", price: 1490000, weight: 520,
    description: "کوله‌پشتی سبک و جادار با بندهای قابل تنظیم، مناسب وسایل روزانه و رفت‌وآمد شهری." },
];

async function main() {
  for (const name of new Set(catalog.map((item) => item.category))) {
    if (!(await categories()).some((item) => item.name === name)) await saveCategory("",name);
  }
  for (const entry of [...catalog].reverse()) {
    const variable = entry.image === "shoes";
    const attributes = variable ? [
      { id: "color", name: "رنگ", values: [{ id: "red", name: "قرمز" }] },
      { id: "size", name: "سایز", values: ["40","41","42"].map((id) => ({ id, name: id })) },
    ] : [];
    const offers: Omit<Offer,"reserved">[] = (variable ? ["40","41","42"] : ["one"]).map<Omit<Offer,"reserved">>((size,index) => ({
      id: randomUUID(), options: Object.fromEntries(variable ? [["color","red"],["size",size]] : []),
      price: entry.price + (variable && index === 2 ? 150000 : 0), stock: variable && index === 0 ? 0 : 12,
      weight: entry.weight, sku: `${entry.image}-${size}`, image: "", active: true,
    }));
    await saveProduct({ ...entry, categoryId: (await categories()).find((item) => item.name === entry.category)?.id,
      status: "published", kind: variable ? "variable" : "simple", attributes, offers, image: `/demo/${entry.image}.jpg` },true);
  }
  if (!(await rules()).length) {
    await saveRule({ id: "", name: "ارسال عادی", priority: 100, fee: 95000, provinces: [], categories: [],
      minQuantity: null,maxQuantity: null,minWeight: null,maxWeight: null,minSubtotal: null,maxSubtotal: null });
  }
  console.log("کالاها و قانون ارسال نمونه آماده‌اند.");
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);