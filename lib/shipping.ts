import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { categories, integer } from "./catalog";
import { db } from "./db";
import { canonicalCity, citiesForProvince } from "./iran-cities";
import { provinces, type ShippingRule } from "./shared";

const bound = integer.nullable();
const schema = z.object({
  id: z.string().max(80), name: z.string().trim().min(1).max(80),
  priority: integer, fee: integer, provinces: z.array(z.enum(provinces)), categories: z.array(z.string()),
  cities: z.array(z.object({ province:z.enum(provinces),city:z.string().min(1).max(100) })).optional(),
  minQuantity: bound, maxQuantity: bound, minWeight: bound, maxWeight: bound,
  minSubtotal: bound, maxSubtotal: bound,
});

function normalizeDestinations(rule: ShippingRule): ShippingRule {
  const cityProvinces = new Set(rule.cities?.map(({ province }) => province));
  return { ...rule,provinces:rule.provinces.filter(province => !cityProvinces.has(province)) };
}

export async function rules(client: PoolClient | ReturnType<typeof db> = db()) {
  const { rows } = await client.query<{ config: string }>("SELECT config FROM shipping ORDER BY priority, sequence");
  return rows.map((row) => normalizeDestinations(JSON.parse(row.config) as ShippingRule));
}

export async function saveRule(input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("نام، اولویت، مبلغ و بازه‌های قانون ارسال را بررسی کنید.");
  const rule = normalizeDestinations(result.data);
  if (rule.cities?.some(({ province,city }) => !citiesForProvince(province).includes(city))) {
    throw new Error("استان و شهرهای قانون ارسال را بررسی کنید.");
  }
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
  province: string; city?: string; categories: Set<string>; quantity: number; weight: number; subtotal: number;
}) {
  const within = (value: number, min: number | null, max: number | null) =>
    (min === null || value >= min) && (max === null || value <= max);
  const destinationCity = stats.city && canonicalCity(stats.province,stats.city);
  let match: ShippingRule | undefined;
  let bestScope = -1;
  for (const rule of list) {
    const cityMatch = rule.cities?.some(({ province,city }) => province === stats.province && city === destinationCity);
    const provinceMatch = rule.provinces.includes(stats.province);
    const nationwide = !rule.provinces.length && !rule.cities?.length;
    const scope = cityMatch ? 2 : provinceMatch ? 1 : nationwide ? 0 : -1;
    if (scope <= bestScope || (rule.categories.length && !rule.categories.some(id => stats.categories.has(id)))
      || !within(stats.quantity,rule.minQuantity,rule.maxQuantity)
      || !within(stats.weight,rule.minWeight,rule.maxWeight)
      || !within(stats.subtotal,rule.minSubtotal,rule.maxSubtotal)) continue;
    match = rule;
    bestScope = scope;
    if (scope === 2) break;
  }
  return match;
}
