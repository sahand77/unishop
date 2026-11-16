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
type OrderRow = Omit<Order, "customer" | "quote"> & { customer: string; quote: string };

function readOrder(row: OrderRow): Order {
  return { ...row, customer: JSON.parse(row.customer), quote: JSON.parse(row.quote) };
}

export function order(id: string) {
  const row = db().prepare("SELECT * FROM orders WHERE id=?").get(id) as unknown as OrderRow | undefined;
  return row && readOrder(row);
}

export function orders() {
  return (db().prepare("SELECT * FROM orders ORDER BY created DESC").all() as unknown as OrderRow[]).map(readOrder);
}

export function quote(input: unknown, destination: unknown): Quote {
  const lines = linesSchema.safeParse(input);
  const province = provinceSchema.safeParse(destination);
  if (!lines.success || !province.success) throw new Error("سبد خرید و استان را بررسی کنید.");
  const lookup = db().prepare(`SELECT o.id,p.title,o.price,o.weight,
    coalesce(nullif(o.image,''),p.image) AS image,o.stock-o.reserved AS available,
    p.category_id AS category,p.attributes,o.options
    FROM offers o JOIN products p ON p.id=o.product_id
    WHERE o.id=? AND o.active=1 AND o.archived=0 AND p.status='published'`);
  const categoryIds = new Set<string>();
  let subtotal = 0;
  let quantity = 0;
  let weight = 0;
  const items = lines.data.map((line) => {
    const row = lookup.get(line.id) as unknown as QuoteRow | undefined;
    if (!row || row.available < line.quantity) throw new Error("موجودی یا وضعیت یکی از کالاهای سبد تغییر کرده است. سبد خرید را بررسی کنید.");
    if (row.category) categoryIds.add(row.category);
    subtotal += row.price * line.quantity;
    weight += row.weight * line.quantity;
    quantity += line.quantity;
    const variant = variationName(JSON.parse(row.attributes), JSON.parse(row.options));
    return { id: row.id, title: row.title, variant, quantity: line.quantity, price: row.price, image: row.image };
  });
  const rule = matchingRule(rules(), { province: province.data, categories: categoryIds, quantity, weight, subtotal });
  if (!rule) throw new Error("برای این سبد و استان، روش ارسال فعالی تعریف نشده است.");
  return { subtotal, quantity, weight, shipping: rule.fee, total: subtotal + rule.fee, items };
}

export function reserveOrder(input: {
  lines: unknown; customer: Customer; attempt: string; shown: Pick<Quote, "subtotal" | "shipping" | "total">; mode: Mode;
}) {
  return transaction(() => {
    const existing = db().prepare("SELECT * FROM orders WHERE attempt=?").get(input.attempt) as unknown as OrderRow | undefined;
    if (existing) return { order: readOrder(existing), fresh: false } as const;
    const pricing = quote(input.lines, input.customer.province);
    if (pricing.total !== input.shown.total || pricing.shipping !== input.shown.shipping || pricing.subtotal !== input.shown.subtotal) {
      return { changed: pricing } as const;
    }
    const reserve = db().prepare("UPDATE offers SET reserved=reserved+? WHERE id=? AND stock-reserved>=?");
    for (const item of pricing.items) {
      if (!reserve.run(item.quantity,item.id,item.quantity).changes) throw new Error("موجودی کالا تغییر کرده است.");
    }
    const id = randomUUID();
    db().prepare(`INSERT INTO orders (id,attempt,secret,customer,quote,amount,mode,status,created,request_started)
      VALUES (?,?,?,?,?,?,?,'pending',?,?)`).run(id,input.attempt,randomBytes(32).toString("hex"),JSON.stringify(input.customer),
        JSON.stringify(pricing),pricing.total * 10,input.mode,Date.now(),Date.now());
    return { order: order(id)!, fresh: true } as const;
  });
}

export function settle(id: string, status: Status, note: string, reference: string | null = null) {
  return transaction(() => {
    const current = order(id);
    if (!current || !["pending","review"].includes(current.status)) return current;
    if (status === "paid" || status === "canceled" || status === "failed") {
      const update = db().prepare("UPDATE offers SET reserved=reserved-?,stock=stock-? WHERE id=?");
      for (const item of current.quote.items) {
        update.run(item.quantity,status === "paid" ? item.quantity : 0,item.id);
      }
    }
    db().prepare("UPDATE orders SET status=?,message=?,reference=? WHERE id=?")
      .run(status,note,reference,id);
    return order(id);
  });
}