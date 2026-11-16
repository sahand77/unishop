import type { PoolClient } from "pg";
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
type ProductRow = Omit<Product, "attributes" | "offers"> & { attributes: string; offers: OfferRow[] };
const productSelect = `SELECT p.id, p.title, p.description, coalesce(p.category_id,'') AS "categoryId",
  p.kind, p.status, p.image, p.attributes, coalesce(v.offers,'[]'::json) AS offers
  FROM products p
  LEFT JOIN LATERAL (
    SELECT json_agg(o ORDER BY o.sequence) AS offers FROM (
      SELECT id,options,price,stock,weight,sku,image,active,reserved,sequence
      FROM offers WHERE product_id=p.id AND archived=0
    ) o
  ) v ON true`;

function hydrate(row: ProductRow): Product {
  return {
    ...row, attributes: JSON.parse(row.attributes),
    offers: row.offers.map(({ id,options,price,stock,weight,sku,image,active,reserved }) =>
      ({ id,options:JSON.parse(options),price,stock,weight,sku,image,active:!!active,reserved })),
  };
}

export async function products(publicOnly = false, category = "") {
  const { rows } = await db().query<ProductRow>(`${productSelect}
    WHERE (NOT $1::boolean OR p.status='published') AND ($2='' OR p.category_id=$2)
    ORDER BY p.updated DESC, p.sequence DESC`,[publicOnly,category]);
  return rows.map(hydrate);
}

export async function product(id: string, publicOnly = false, client: PoolClient | ReturnType<typeof db> = db()) {
  const { rows:[row] } = await client.query<ProductRow>(`${productSelect} WHERE p.id=$1 AND (NOT $2::boolean OR p.status='published')`,
    [id,publicOnly]);
  return row && hydrate(row);
}

export async function categories() {
  const { rows } = await db().query<Category>("SELECT id,name FROM categories");
  return rows.sort((a, b) => a.name.localeCompare(b.name,"fa"));
}

export async function saveCategory(categoryId: string, rawName: string) {
  const name = rawName.trim();
  if (!name || name.length > 80) throw new Error("نام دسته را وارد کنید.");
  const result = categoryId
    ? await db().query("UPDATE categories SET name=$1 WHERE id=$2",[name,categoryId])
    : await db().query("INSERT INTO categories (id,name) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING",[randomUUID(),name]);
  if (!result.rowCount) throw new Error(categoryId ? "دسته پیدا نشد." : "این نام برای دستهٔ دیگری استفاده شده است.");
}

function unique(values: string[]) {
  return new Set(values).size === values.length;
}

export async function saveProduct(input: unknown, createOnly = false) {
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
  return transaction(async (client) => {
    const previous = item.id ? await product(item.id,false,client) : undefined;
    if (createOnly && previous) return productId;
    if (item.id && !previous && !createOnly) throw new Error("کالا پیدا نشد.");
    if (item.categoryId && !(await client.query("SELECT 1 FROM categories WHERE id=$1",[item.categoryId])).rowCount) {
      throw new Error("دستهٔ انتخاب‌شده پیدا نشد.");
    }
    for (const offer of offers) {
      if ((await client.query("SELECT 1 FROM offers WHERE sku=$1 AND product_id<>$2 AND archived=0",[offer.sku,productId])).rowCount) {
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
      if (!existing && (await client.query("SELECT 1 FROM offers WHERE id=$1",[offer.id])).rowCount) {
        throw new Error("شناسهٔ ترکیب معتبر نیست.");
      }
    }
    await client.query(`INSERT INTO products (id,title,description,category_id,kind,status,image,attributes,updated)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,
      category_id=excluded.category_id,kind=excluded.kind,status=excluded.status,image=excluded.image,
      attributes=excluded.attributes,updated=excluded.updated`,[productId,item.title,item.description,item.categoryId || null,
      item.kind,item.status,item.image,JSON.stringify(attributes),Date.now()]);
    await client.query("UPDATE offers SET archived=1 WHERE product_id=$1",[productId]);
    for (const offer of offers) {
      await client.query(`INSERT INTO offers (id,product_id,options,combination,price,stock,weight,sku,image,active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET options=excluded.options,
        combination=excluded.combination,price=excluded.price,stock=excluded.stock,weight=excluded.weight,
        sku=excluded.sku,image=excluded.image,active=excluded.active,archived=0`,
        [offer.id,productId,JSON.stringify(offer.options),selectionKey(offer.options),offer.price,
          offer.stock,offer.weight,offer.sku,offer.image,+offer.active]);
    }
    return productId;
  });
}

export function variationName(attributes: Product["attributes"], options: Offer["options"]) {
  return attributes.map((a) => a.values.find((v) => v.id === options[a.id])?.name).filter(Boolean).join(" / ");
}