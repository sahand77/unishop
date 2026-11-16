import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { selectionKey, type Category, type Offer, type Product } from "./shared";

const id = z.string().regex(/^[A-Za-z0-9-]{1,80}$/);
const image = z.string().max(500).refine((value) => !value || /^\/(uploads|demo)\/[a-z0-9.-]+$/i.test(value));
export const integer = z.number().int().min(0).max(1_000_000_000);
const attributeSchema = z.object({
  id, name: z.string().trim().min(1).max(60),
  values: z.array(z.object({ id, name: z.string().trim().min(1).max(60) })).min(1).max(30),
});
const offerSchema = z.object({
  id, options: z.record(id, id), price: integer, expectedStock: integer.optional(),
  stock: integer, weight: integer, sku: z.string().trim().min(1).max(80),
  image, active: z.boolean(),
}).refine((offer) => !offer.active || offer.price > 0);
const productSchema = z.object({
  id: id.optional(), title: z.string().trim().min(1).max(150), description: z.string().trim().max(10000),
  categoryId: z.union([id, z.literal("")]), kind: z.enum(["simple", "variable"]),
  status: z.enum(["draft", "published"]), image,
  attributes: z.array(attributeSchema).max(8), offers: z.array(offerSchema).max(300),
});

type OfferRow = Omit<Offer, "options" | "active"> & { options: string; active: number };
type ProductRow = Omit<Product, "attributes" | "offers"> & { attributes: string };
const productSelect = `SELECT id, title, description, coalesce(category_id,'') AS categoryId,
  kind, status, image, attributes FROM products`;

function hydrate(row: ProductRow): Product {
  const rows = db().prepare(`SELECT id,options,price,stock,weight,sku,image,active,reserved
    FROM offers WHERE product_id=? AND archived=0 ORDER BY rowid`).all(row.id) as unknown as OfferRow[];
  return {
    ...row, attributes: JSON.parse(row.attributes),
    offers: rows.map((offer) => ({ ...offer, options: JSON.parse(offer.options), active: !!offer.active })),
  };
}

export function products(publicOnly = false, category = "") {
  const rows = db().prepare(`${productSelect}
    WHERE (?=0 OR status='published') AND (?='' OR category_id=?) ORDER BY updated DESC, rowid DESC`)
    .all(+publicOnly, category, category) as unknown as ProductRow[];
  return rows.map(hydrate);
}

export function product(id: string, publicOnly = false) {
  const row = db().prepare(`${productSelect} WHERE id=? AND (?=0 OR status='published')`)
    .get(id, +publicOnly) as unknown as ProductRow | undefined;
  return row && hydrate(row);
}

export function categories() {
  return (db().prepare("SELECT id,name FROM categories ORDER BY rowid").all() as unknown as Category[])
    .map(({ id,name }) => ({ id,name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

export function saveCategory(categoryId: string, rawName: string) {
  const name = rawName.trim();
  if (!name || name.length > 80) throw new Error("نام دسته را وارد کنید.");
  if (db().prepare("SELECT id FROM categories WHERE name=? AND id<>?").get(name, categoryId)) {
    throw new Error("این نام برای دستهٔ دیگری استفاده شده است.");
  }
  if (categoryId) {
    if (!db().prepare("UPDATE categories SET name=? WHERE id=?").run(name, categoryId).changes) {
      throw new Error("دسته پیدا نشد.");
    }
  } else {
    db().prepare("INSERT INTO categories VALUES (?,?)").run(randomUUID(), name);
  }
}

function unique(values: string[]) {
  return new Set(values).size === values.length;
}

export function saveProduct(input: unknown) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) throw new Error("عنوان، قیمت، وزن، موجودی و کد کالا را بررسی کنید.");
  const item = parsed.data;
  const productId = item.id ?? randomUUID();
  const attributes = item.kind === "variable" ? item.attributes : [];
  const offers = item.offers;
  if (!unique(attributes.map((a) => a.id)) || !unique(attributes.map((a) => a.name))
      || attributes.some((a) => !unique(a.values.map((v) => v.id)) || !unique(a.values.map((v) => v.name)))) {
    throw new Error("نام ویژگی‌ها و مقادیر هر ویژگی باید یکتا باشد.");
  }
  if ((item.kind === "simple" && offers.length !== 1)
      || (item.kind === "variable" && offers.length > 0 && attributes.length === 0)
      || (item.status === "published" && !offers.some((offer) => offer.active))) {
    throw new Error("برای انتشار، حداقل یک گزینهٔ فعال تعریف کنید.");
  }
  if (!unique(offers.map((offer) => offer.id)) || !unique(offers.map((offer) => offer.sku))
      || !unique(offers.map((offer) => selectionKey(offer.options)))) {
    throw new Error("ترکیب و کد کالا باید یکتا باشند.");
  }
  for (const offer of offers) {
    if (Object.keys(offer.options).length !== attributes.length
        || !attributes.every((a) => a.values.some((v) => v.id === offer.options[a.id]))) {
      throw new Error("برای هر ترکیب یک مقدار معتبر از هر ویژگی انتخاب کنید.");
    }
  }
  return transaction(() => {
    const connection = db();
    const previous = item.id ? product(item.id) : undefined;
    if (item.id && !previous) throw new Error("کالا پیدا نشد.");
    if (item.categoryId && !connection.prepare("SELECT 1 FROM categories WHERE id=?").get(item.categoryId)) {
      throw new Error("دستهٔ انتخاب‌شده پیدا نشد.");
    }
    for (const offer of offers) {
      if (connection.prepare("SELECT 1 FROM offers WHERE sku=? AND product_id<>? AND archived=0").get(offer.sku, productId)) {
        throw new Error(`کد کالای «${offer.sku}» پیش‌تر استفاده شده است.`);
      }
      const existing = previous?.offers.find((old) => old.id === offer.id);
      if (existing && offer.expectedStock !== undefined && existing.stock !== offer.expectedStock) {
        throw new Error("موجودی کالا پس از باز شدن فرم تغییر کرده است. صفحه را تازه کنید.");
      }
      if (existing && (offer.stock < existing.reserved
          || (existing.reserved > 0 && selectionKey(existing.options) !== selectionKey(offer.options)))) {
        throw new Error("ترکیب دارای رزرو فعال است و موجودی آن نباید از تعداد رزرو کمتر باشد.");
      }
      if (!existing && connection.prepare("SELECT 1 FROM offers WHERE id=?").get(offer.id)) {
        throw new Error("شناسهٔ ترکیب معتبر نیست.");
      }
    }
    connection.prepare(`INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,
      category_id=excluded.category_id,kind=excluded.kind,status=excluded.status,image=excluded.image,
      attributes=excluded.attributes,updated=excluded.updated`)
      .run(productId,item.title,item.description,item.categoryId || null,item.kind,item.status,item.image,
        JSON.stringify(attributes),Date.now());
    connection.prepare("UPDATE offers SET archived=1 WHERE product_id=?").run(productId);
    for (const offer of offers) {
      connection.prepare(`INSERT INTO offers (id,product_id,options,combination,price,stock,weight,sku,image,active)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET options=excluded.options,
        combination=excluded.combination,price=excluded.price,stock=excluded.stock,weight=excluded.weight,
        sku=excluded.sku,image=excluded.image,active=excluded.active,archived=0`)
        .run(offer.id,productId,JSON.stringify(offer.options),selectionKey(offer.options),
          offer.price,offer.stock,offer.weight,offer.sku,offer.image,+offer.active);
    }
    return productId;
  });
}

export function variationName(attributes: Product["attributes"], options: Offer["options"]) {
  return attributes.map((a) => a.values.find((v) => v.id === options[a.id])?.name).filter(Boolean).join(" / ");
}