import type { PoolClient } from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { variationName } from "./catalog";
import { db, transaction } from "./db";
import { matchingRule, rules } from "./shipping";
import { provinces, type FulfillmentStatus, type Quote, type paymentLabels } from "./shared";

export const linesSchema = z.array(z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/i), quantity: z.number().int().min(1).max(99),
})).min(1).max(50).refine((lines) => new Set(lines.map((line) => line.id)).size === lines.length);
export const provinceSchema = z.enum(provinces);
export { customerSchema } from "./recipient";
export type { Customer } from "./recipient";
import type { Customer } from "./recipient";
export type Status = keyof typeof paymentLabels;
export type Mode = "sandbox" | "live" | "simulator";
type QuoteRow = {
  id: string; title: string; price: number; weight: number; image: string; available: number;
  category: string | null; attributes: string; options: string;
};
export type Order = {
  customer_id: string | null; tracking_code: string | null; id: string; attempt: string; secret: string; customer: Customer; quote: Quote; amount: number;
  authority: string | null; mode: Mode; status: Status;
  fulfillment_status: FulfillmentStatus;
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
    CASE WHEN p.gallery @> jsonb_build_array(jsonb_build_object('kind','video','url',o.image)) THEN p.image ELSE coalesce(nullif(o.image,''),p.image) END AS image,o.stock-o.reserved AS available,
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
  customerId?: string; lines: unknown; customer: Customer; attempt: string; shown: Pick<Quote, "subtotal" | "shipping" | "total">; mode: Mode;
}) {
  return transaction(async (client) => {
    const { rows:[existing] } = await client.query<OrderRow>("SELECT * FROM orders WHERE attempt=$1",[input.attempt]);
    if (existing && existing.customer_id !== (input.customerId ?? null)) throw new Error("لطفاً سفارش را دوباره ثبت کنید.");
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
      `INSERT INTO orders (id,attempt,secret,customer,quote,amount,mode,status,created,request_started,customer_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$8,$9) RETURNING *`,
      [id,input.attempt,randomBytes(32).toString("hex"),JSON.stringify(input.customer),
        JSON.stringify(pricing),pricing.total * 10,input.mode,Date.now(),input.customerId ?? null]);
    return { order: readOrder(created), fresh: true } as const;
  });
}

export function reopenPayment(id: string) {
  return transaction(async client => {
    const current = await order(id, client);
    if (!current || current.fulfillment_status === "canceled" || !["failed", "canceled"].includes(current.status)) return null;
    for (const line of current.quote.items) {
      const result = await client.query(
        "UPDATE offers SET reserved=reserved+$1 WHERE id=$2 AND active=1 AND archived=0 AND stock-reserved >= $1",
        [line.quantity, line.id]);
      if (!result.rowCount) throw new Error("موجودی یکی از کالاها برای پرداخت مجدد کافی نیست.");
    }
    const { rows } = await client.query<OrderRow>(
      "UPDATE orders SET status='pending', authority=NULL, message=NULL, reference=NULL, request_started=$2 WHERE id=$1 RETURNING *",
      [id, Date.now()]);
    return readOrder(rows[0]);
  });
}

export function canCancelOrder(item: Order) {
  return item.fulfillment_status === "awaiting_confirmation"
    && ["pending", "review"].includes(item.status)
    && (item.mode !== "live" || !item.authority);
}

async function releaseReservation(client: PoolClient, item: Order, paid: boolean) {
  for (const line of item.quote.items) {
    await client.query("UPDATE offers SET reserved=reserved-$1,stock=stock-$2 WHERE id=$3",
      [line.quantity, paid ? line.quantity : 0, line.id]);
  }
}

export function cancelOrder(id: string) {
  return transaction(async client => {
    const { rows: [row] } = await client.query<OrderRow>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id]);
    if (!row) return false;
    const current = readOrder(row);
    if (current.fulfillment_status === "canceled") return true;
    if (!canCancelOrder(current)) return false;

    await releaseReservation(client, current, false);
    await client.query(`UPDATE orders SET status='canceled', fulfillment_status='canceled', message=$2 WHERE id=$1`,
      [id, "سفارش توسط مدیر لغو شد."]);
    return true;
  });
}

export function settle(id: string, status: Status, note: string, reference: string | null = null, attempt?: Order) {
  return transaction(async (client) => {
    const current = await order(id,client);
    if (!current) throw new Error("سفارش پیدا نشد.");
    if (attempt && (current.authority !== attempt.authority || current.request_started !== attempt.request_started)) return current;
    if (!["pending","review"].includes(current.status)) return current;
    if (status === "paid" || status === "canceled" || status === "failed") {
      await releaseReservation(client, current, status === "paid");
    }
    const { rows:[updated] } = await client.query<OrderRow>(
      "UPDATE orders SET status=$1,message=$2,reference=$3 WHERE id=$4 RETURNING *",[status,note,reference,id]);
    return readOrder(updated);
  });
}
