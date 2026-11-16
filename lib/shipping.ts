import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { categories, integer } from "./catalog";
import { db } from "./db";
import { provinces, type ShippingRule } from "./shared";

const bound = integer.nullable();
const schema = z.object({
  id: z.string().max(80), name: z.string().trim().min(1).max(80),
  priority: integer, fee: integer, provinces: z.array(z.enum(provinces)), categories: z.array(z.string()),
  minQuantity: bound, maxQuantity: bound, minWeight: bound, maxWeight: bound,
  minSubtotal: bound, maxSubtotal: bound,
});

export async function rules(client: PoolClient | ReturnType<typeof db> = db()) {
  const { rows } = await client.query<{ config: string }>("SELECT config FROM shipping ORDER BY priority, sequence");
  return rows.map((row) => JSON.parse(row.config) as ShippingRule);
}

export async function saveRule(input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("نام، اولویت، مبلغ و بازه‌های قانون ارسال را بررسی کنید.");
  const rule = result.data;
  for (const [min, max] of [[rule.minQuantity,rule.maxQuantity], [rule.minWeight,rule.maxWeight], [rule.minSubtotal,rule.maxSubtotal]]) {
    if (min !== null && max !== null && min > max) {
      throw new Error("ابتدای بازه باید از انتهای آن کوچک‌تر یا برابر باشد.");
    }
  }
  const categoryIds = new Set((await categories()).map((item) => item.id));
  if (rule.categories.some((id) => !categoryIds.has(id))) throw new Error("دستهٔ قانون ارسال معتبر نیست.");
  rule.id ||= randomUUID();
  await db().query(`INSERT INTO shipping (id,priority,config) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET
    priority=excluded.priority,config=excluded.config`,[rule.id,rule.priority,JSON.stringify(rule)]);
}

export function matchingRule(list: ShippingRule[], stats: {
  province: string; categories: Set<string>; quantity: number; weight: number; subtotal: number;
}) {
  const within = (value: number, min: number | null, max: number | null) =>
    (min === null || value >= min) && (max === null || value <= max);
  return list.find((rule) =>
    (!rule.provinces.length || rule.provinces.includes(stats.province))
    && (!rule.categories.length || rule.categories.some((id) => stats.categories.has(id)))
    && within(stats.quantity,rule.minQuantity,rule.maxQuantity)
    && within(stats.weight,rule.minWeight,rule.maxWeight)
    && within(stats.subtotal,rule.minSubtotal,rule.maxSubtotal));
}