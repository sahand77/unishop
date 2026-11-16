import type { PoolClient } from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { variationName } from "./catalog";
import { db, transaction } from "./db";
import { matchingRule, rules } from "./shipping";
import { provinces, type Quote, type paymentLabels } from "./shared";

export const linesSchema = z.array(z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/i), quantity: z.number().int().min(1).max(99),
})).min(1).max(50).refine((lines) => new Set(lines.map((line) => line.id)).size === lines.length);
export const provinceSchema = z.enum(provinces);
export const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: z.string().regex(/^09\d{9}$/),
  province: provinceSchema, city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(8).max(500), postalCode: z.string().regex(/^\d{10}$/),
});
export type Customer = z.infer<typeof customerSchema>;
export type Status = keyof typeof paymentLabels;
export type Mode = "sandbox" | "live" | "simulator";
type QuoteRow = {
  id: string; title: string; price: number; weight: number; image: string; available: number;
  category: string | null; attributes: string; options: string;
};
export type Order = {
  id: string; attempt: string; secret: string; customer: Customer; quote: Quote; amount: number;
  authority: string | null; mode: Mode; status: Status;
  reference: string | null; message: string | null; created: number; request_started: number;
};
type OrderRow = Omit<Order, "customer" | "quote" | "amount" | "created" | "request_started">
  & { customer: string; quote: string; amount: string; created: string; request_started: string };

function readOrder(row: OrderRow): Order {
  return { ...row, customer: JSON.parse(row.customer), quote: JSON.parse(row.quote),
    amount: Number(row.amount), created: Number(row.created), request_started: Number(row.request_started) };
}

export async function order(id: string, client: PoolClient | ReturnType<typeof db> = db()) {
  const { rows:[row] } = await client.query<OrderRow>("SELECT * FROM orders WHERE id=$1",[id]);
  return row && readOrder(row);
}

export async function orders() {
  const { rows } = await db().query<OrderRow>("SELECT * FROM orders ORDER BY created DESC");
  return rows.map(readOrder);
}

export async function quote(input: unknown, destination: unknown, client: PoolClient | ReturnType<typeof db> = db()): Promise<Quote> {
  const lines = linesSchema.safeParse(input);
  const province = provinceSchema.safeParse(destination);
  if (!lines.success || !province.success) throw new Error("سبد خرید و استان را بررسی کنید.");
  const { rows } = await client.query<QuoteRow>(`SELECT o.id,p.title,o.price,o.weight,
    coalesce(nullif(o.image,''),p.image) AS image,o.stock-o.reserved AS available,
    p.category_id AS category,p.attributes,o.options
    FROM offers o JOIN products p ON p.id=o.product_id
    WHERE o.id=ANY($1::text[]) AND o.active=1 AND o.archived=0 AND p.status='published'`,[lines.data.map((line) => line.id)]);
  const offers = new Map(rows.map((row) => [row.id,row]));
  const categoryIds = new Set<string>();
  let subtotal = 0;
  let quantity = 0;
  let weight = 0;
  const items = lines.data.map((line) => {
    const row = offers.get(line.id);
    if (!row || row.available < line.quantity) throw new Error("موجودی یا وضعیت یکی از کالاهای سبد تغییر کرده است. سبد خرید را بررسی کنید.");
    if (row.category) categoryIds.add(row.category);
    subtotal += row.price * line.quantity;
    weight += row.weight * line.quantity;
    quantity += line.quantity;
    const variant = variationName(JSON.parse(row.attributes), JSON.parse(row.options));
    return { id: row.id, title: row.title, variant, quantity: line.quantity, price: row.price, image: row.image };
  });
  const rule = matchingRule(await rules(client), { province: province.data, categories: categoryIds, quantity, weight, subtotal });
  if (!rule) throw new Error("برای این سبد و استان، روش ارسال فعالی تعریف نشده است.");
  return { subtotal, quantity, weight, shipping: rule.fee, total: subtotal + rule.fee, items };
}

export function reserveOrder(input: {
  lines: unknown; customer: Customer; attempt: string; shown: Pick<Quote, "subtotal" | "shipping" | "total">; mode: Mode;
}) {
  return transaction(async (client) => {
    const { rows:[existing] } = await client.query<OrderRow>("SELECT * FROM orders WHERE attempt=$1",[input.attempt]);
    if (existing) return { order: readOrder(existing), fresh: false } as const;
    const pricing = await quote(input.lines, input.customer.province,client);
    if (pricing.total !== input.shown.total || pricing.shipping !== input.shown.shipping || pricing.subtotal !== input.shown.subtotal) {
      return { changed: pricing } as const;
    }
    for (const item of pricing.items) {
      const result = await client.query("UPDATE offers SET reserved=reserved+$1 WHERE id=$2 AND stock-reserved>=$1",
        [item.quantity,item.id]);
      if (!result.rowCount) throw new Error("موجودی کالا تغییر کرده است.");
    }
    const id = randomUUID();
    const { rows:[created] } = await client.query<OrderRow>(
      `INSERT INTO orders (id,attempt,secret,customer,quote,amount,mode,status,created,request_started)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$8) RETURNING *`,
      [id,input.attempt,randomBytes(32).toString("hex"),JSON.stringify(input.customer),
        JSON.stringify(pricing),pricing.total * 10,input.mode,Date.now()]);
    return { order: readOrder(created), fresh: true } as const;
  });
}

export function settle(id: string, status: Status, note: string, reference: string | null = null) {
  return transaction(async (client) => {
    const current = await order(id,client);
    if (!current) throw new Error("سفارش پیدا نشد.");
    if (!["pending","review"].includes(current.status)) return current;
    if (status === "paid" || status === "canceled" || status === "failed") {
      for (const item of current.quote.items) {
        await client.query("UPDATE offers SET reserved=reserved-$1,stock=stock-$2 WHERE id=$3",
          [item.quantity,status === "paid" ? item.quantity : 0,item.id]);
      }
    }
    const { rows:[updated] } = await client.query<OrderRow>(
      "UPDATE orders SET status=$1,message=$2,reference=$3 WHERE id=$4 RETURNING *",[status,note,reference,id]);
    return readOrder(updated);
  });
}