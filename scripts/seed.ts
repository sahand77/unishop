import { randomUUID } from "node:crypto";
import { categories, saveCategory, saveProduct } from "../lib/catalog";
import { closeDb, db } from "../lib/db";
import type { ProductMedia } from "../lib/product-media";
import { rules, saveRule } from "../lib/shipping";

const scarfGallery: ProductMedia[] = [
  { kind:"image",url:"/demo/sadena-wool-2.webp" },
  { kind:"image",url:"/demo/sadena-wool-3.webp" },
  { kind:"image",url:"/demo/sadena-wool-4.webp" },
  { kind:"video",url:"/demo/sadena-wool.mp4" },
];

const catalog = [
  { id:"demo-sadena-67111427", title:"روسری پشمی زمستانی قواره ۹۰", category:"شال و روسری",
    image:"/demo/sadena-wool-1.webp", price:1_765_000, weight:140, gallery:scarfGallery,
    colors:[{ id:"black-brown",name:"مشکی نسکافه‌ای" },{ id:"ivory",name:"یخی شیری" },{ id:"beige",name:"کرم شیری" }],
    description:"روسری دورو با طرح شکوفه و قوارهٔ ۹۰ سانتی‌متر. هر سمت رنگ متفاوتی دارد. ویدئوی گالری از عکس‌های کالا ساخته شده است." },
  { id:"demo-sadena-67214720", title:"چادر مشکی لوکس طرح فروغ", category:"چادر",
    image:"/demo/sadena-forough.webp", price:8_200_000, weight:450,
    description:"چادر مشکی طرح فروغ برای پوشش مجلسی." },
  { id:"demo-sadena-67024053", title:"چادر مشکی مجلسی جواهردوزی طرح سرو", category:"چادر",
    image:"/demo/sadena-sarv.webp", price:8_400_000, weight:450,
    description:"چادر مشکی مجلسی با جواهردوزی طرح سرو." },
  { id:"demo-sadena-67023186", title:"چادر مشکی جواهردوزی طرح تک‌تاش", category:"چادر",
    image:"/demo/sadena-taktash.webp", price:8_500_000, weight:450,
    description:"چادر مشکی با تزیین جواهردوزی طرح تک‌تاش." },
];
const previousDemoIds = ["demo-headphones","demo-shoes","demo-watch","demo-bag"];

async function main() {
  for (const name of new Set(catalog.map((item) => item.category))) {
    if (!(await categories()).some((item) => item.name === name)) await saveCategory("",name);
  }
  const groups = await categories();
  for (const entry of [...catalog].reverse()) {
    const { colors,category,...product } = entry;
    const attributes = colors ? [{ id:"color",name:"رنگ",values:colors }] : [];
    const offers = (colors ?? [{ id:"one" }]).map((color,index) => ({
      id:randomUUID(), options:Object.fromEntries(colors ? [["color",color.id]] : []),
      price:entry.price, stock:index === 0 ? 3 : 7,
      weight:entry.weight, sku:`SADENA-${entry.id.split("-").at(-1)}-${color.id}`, image:"", active:true,
    }));
    await saveProduct({
      ...product, categoryId:groups.find((item) => item.name === category)?.id,
      description: `${entry.description}\nاین کالا برای آزمایش فروشگاه اضافه شده است.`,
      kind: colors ? "variable" : "simple", status:"published", attributes, offers,
    },true);
  }
  // Retain references in old orders and hide only the four previous seed products.
  await db().query("UPDATE products SET status='draft' WHERE id=ANY($1::text[])",[previousDemoIds]);
  if (!(await rules()).length) {
    await saveRule({ id:"",name:"ارسال عادی",priority:100,fee:95000,provinces:[],categories:[],
      minQuantity:null,maxQuantity:null,minWeight:null,maxWeight:null,minSubtotal:null,maxSubtotal:null });
  }
  console.log("کالاهای نمونهٔ سدنا آماده‌اند.");
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);
