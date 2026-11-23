import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { basalamMediaUrl } from "./product-media";
import { selectionKey, type Category, type Offer, type Product } from "./shared";

const id = z.string().regex(/^[A-Za-z0-9-]{1,80}$/);
const imageUrl = /^\/(uploads|demo)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i;
const videoUrl = /^\/(uploads|demo)\/[a-z0-9-]+\.(mp4|webm)$/i;
const image = z.string().max(500).refine((value) => !value || imageUrl.test(value) || basalamMediaUrl(value));
const gallery = z.array(z.discriminatedUnion("kind",[
  z.object({ kind:z.literal("image"),url:z.string().max(500).refine(value => imageUrl.test(value) || basalamMediaUrl(value)) }),
  z.object({ kind:z.literal("video"),url:z.string().max(500).refine(value => videoUrl.test(value) || basalamMediaUrl(value)) }),
])).refine((items) => new Set(items.map((item) => item.url)).size === items.length);
export const integer = z.number().int().min(0).max(1_000_000_000);
const attributeSchema = z.object({
  id, name: z.string().trim().min(1).max(60),
  values: z.array(z.object({ id, name: z.string().trim().min(1).max(60) })).min(1).max(30),
});
const offerSchema = z.object({
  id, options: z.record(id, id), price: integer, expectedStock: integer.optional(),
  stock: integer, weight: integer, sku: z.string().trim().min(1).max(80),
  image: z.union([image,z.string().max(500).regex(videoUrl)]), active: z.boolean(),
}).refine((offer) => !offer.active || offer.price > 0);
const productSchema = z.object({
  id: id.optional(), title: z.string().trim().min(1).max(150), description: z.string().trim().max(10000),
  categoryId: z.union([id, z.literal("")]), kind: z.enum(["simple", "variable"]),
  status: z.enum(["draft", "published"]), image, gallery: gallery.optional(),
  attributes: z.array(attributeSchema).max(8), offers: z.array(offerSchema).max(300),
});

type OfferRow = Omit<Offer, "options" | "active"> & { options: string; active: number };
type ProductRow = Omit<Product, "attributes" | "offers"> & { attributes: string; offers: OfferRow[] };
const productSelect = `SELECT p.id, p.title, p.description, coalesce(p.category_id,'') AS "categoryId",
  p.kind, p.status, p.image, p.gallery, p.attributes, coalesce(v.offers,'[]'::json) AS offers
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

const productsPerPage = 12;

export function parseProductPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page > 0 && page <= Math.floor(Number.MAX_SAFE_INTEGER / productsPerPage) ? page : 1;
}

export async function productPage(page: number, publicOnly = false, category = "", search = "") {
  const { rows } = await db().query<ProductRow>(`WITH RECURSIVE category_branch(id) AS (
      SELECT id FROM categories WHERE id=$2
      UNION SELECT c.id FROM categories c JOIN category_branch b ON c.parent_id=b.id
    ) ${productSelect}
    WHERE (NOT $1::boolean OR p.status='published') AND ($2='' OR p.category_id IN (SELECT id FROM category_branch))
      AND ($3='' OR strpos(translate(lower(p.title),'كي','کی'),translate(lower($3),'كي','کی')) > 0)
    ORDER BY p.updated DESC, p.sequence DESC, p.id
    LIMIT $4 OFFSET $5`,[publicOnly,category,search,productsPerPage + 1,(page - 1) * productsPerPage]);
  return { items: rows.slice(0,productsPerPage).map(hydrate), hasNext: rows.length > productsPerPage };
}

export async function productCount() {
  const { rows:[row] } = await db().query<{ count: string }>("SELECT count(*) FROM products");
  return Number(row.count);
}

export async function featuredProduct() {
  const { rows:[row] } = await db().query<Pick<Product,"id" | "title" | "image">>(`
    SELECT id,title,image FROM products WHERE status='published' AND image<>''
    ORDER BY (id='demo-sadena-67111427') DESC, updated DESC, sequence DESC, id LIMIT 1`);
  return row;
}

export async function relatedProducts(id: string, categoryId: string) {
  const { rows } = await db().query<ProductRow>(`${productSelect}
    WHERE p.status='published' AND p.id<>$1
    ORDER BY (coalesce(p.category_id,'') = $2) DESC, p.updated DESC, p.sequence DESC LIMIT 4`,[id,categoryId]);
  return rows.map(hydrate);
}

export async function product(id: string, publicOnly = false, client: PoolClient | ReturnType<typeof db> = db()) {
  const { rows:[row] } = await client.query<ProductRow>(`${productSelect} WHERE p.id=$1 AND (NOT $2::boolean OR p.status='published')`,
    [id,publicOnly]);
  return row && hydrate(row);
}

export async function categories() {
  const { rows } = await db().query<Category>('SELECT id,name,parent_id AS "parentId" FROM categories');
  return rows.sort((a, b) => a.name.localeCompare(b.name,"fa"));
}

export async function saveCategory(categoryId: string, rawName: string, parentId?: string) {
  const name = rawName.trim();
  if (!name || name.length > 80) throw new Error("نام دسته را وارد کنید.");
  await transaction(async client => {
    if (parentId) {
      const { rows } = await client.query<{ id: string }>(`WITH RECURSIVE ancestors(id,parent_id) AS (
        SELECT id,parent_id FROM categories WHERE id=$1
        UNION SELECT c.id,c.parent_id FROM categories c JOIN ancestors a ON c.id=a.parent_id
      ) SELECT id FROM ancestors`,[parentId]);
      if (!rows.length) throw new Error("دستهٔ والد پیدا نشد.");
      if (rows.some(row => row.id === categoryId)) throw new Error("دستهٔ والد را از بیرون این شاخه انتخاب کنید.");
    }
    if ((await client.query("SELECT 1 FROM categories WHERE name=$1 AND id<>$2",[name,categoryId])).rowCount) {
      throw new Error("این نام برای دستهٔ دیگری استفاده شده است.");
    }
    if (categoryId) {
      const result = await client.query(`UPDATE categories SET name=$1,
        parent_id=CASE WHEN $3::text IS NULL THEN parent_id ELSE NULLIF($3,'') END WHERE id=$2`,[name,categoryId,parentId ?? null]);
      if (!result.rowCount) throw new Error("دسته پیدا نشد.");
    } else {
      await client.query("INSERT INTO categories (id,name,parent_id) VALUES ($1,$2,$3)",[randomUUID(),name,parentId || null]);
    }
  });
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
    const media = item.gallery ?? previous?.gallery ?? [];
    const cover = item.image || media.find((entry) => entry.kind === "image")?.url || "";
    await client.query(`INSERT INTO products (id,title,description,category_id,kind,status,image,attributes,updated,gallery)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,
      category_id=excluded.category_id,kind=excluded.kind,status=excluded.status,image=excluded.image,
      attributes=excluded.attributes,updated=excluded.updated,gallery=excluded.gallery`,[productId,item.title,item.description,item.categoryId || null,
      item.kind,item.status,cover,JSON.stringify(attributes),Date.now(),JSON.stringify(media)]);
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
