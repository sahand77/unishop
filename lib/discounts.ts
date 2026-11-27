import { randomInt } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { money } from "./shared";

const codeSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,32}$/)
  .transform(code => code.toUpperCase());
const discountSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("percent"), value: z.number().int().min(1).max(100) }),
  z.object({ kind: z.literal("fixed"), value: z.number().int().min(1).max(1_000_000_000) }),
]);
const optionalAmount = z.number().int().min(1).max(1_000_000_000).nullish();
export type Discount = z.infer<typeof discountSchema> & {
  code: string; active: boolean; minSubtotal: number | null; maxDiscount: number | null;
};
export type DiscountDraft = Omit<Discount, "value"> & { value: number | null };
const discountColumns = 'code, kind, value, active, min_subtotal AS "minSubtotal", max_discount AS "maxDiscount"';

export async function discounts() {
  const { rows } = await db().query<Discount>(`SELECT ${discountColumns} FROM discounts ORDER BY code`);
  return rows;
}

export async function suggestDiscountCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = String(randomInt(10_000_000, 100_000_000));
    const { rowCount } = await db().query("SELECT 1 FROM discounts WHERE code=$1", [code]);
    if (rowCount === 0) return code;
  }
  throw new Error("ساخت کد تخفیف انجام نشد. دوباره تلاش کنید.");
}

export async function saveDiscount(input: unknown, editing: boolean) {
  const result = z.object({
    code: codeSchema, pricing: discountSchema, active: z.boolean(),
    minSubtotal: optionalAmount, maxDiscount: optionalAmount,
  }).safeParse(input);
  if (!result.success) {
    const field = result.error.issues[0].path[0];
    if (field === "code") {
      throw new Error("کد تخفیف باید ۱ تا ۳۲ نویسه و شامل حروف انگلیسی، اعداد، خط تیره یا زیرخط باشد.");
    }
    if (field === "minSubtotal" || field === "maxDiscount") {
      throw new Error("حداقل جمع سبد و سقف تخفیف باید خالی یا بین ۱ و ۱ میلیارد تومان باشند.");
    }
    throw new Error("درصد تخفیف باید بین ۱ و ۱۰۰ و مبلغ ثابت بین ۱ و ۱ میلیارد تومان باشد.");
  }
  const { code, pricing: { kind, value }, active, minSubtotal, maxDiscount } = result.data;
  const { rowCount } = await transaction(client => client.query(editing
    ? "UPDATE discounts SET kind=$2, value=$3, active=$4, min_subtotal=$5, max_discount=$6 WHERE code=$1"
    : `INSERT INTO discounts (code, kind, value, active, min_subtotal, max_discount)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
  [code, kind, value, active, minSubtotal ?? null, kind === "percent" ? maxDiscount ?? null : null]));
  if (!rowCount) throw new Error(editing ? "کد تخفیف پیدا نشد." : "این کد تخفیف قبلاً ثبت شده است.");
}

export async function appliedDiscount(input: unknown, subtotal: number, client: Pick<ReturnType<typeof db>, "query">) {
  if (input === undefined || (typeof input === "string" && !input.trim())) return undefined;
  const code = codeSchema.safeParse(input);
  if (!code.success) throw new Error("کد تخفیف معتبر نیست.");
  const { rows: [discount] } = await client.query<Discount>(
    `SELECT ${discountColumns} FROM discounts WHERE code=$1 AND active`, [code.data]);
  if (!discount) throw new Error("کد تخفیف معتبر نیست یا غیرفعال شده است.");
  if (discount.minSubtotal !== null && subtotal < discount.minSubtotal) {
    throw new Error(`برای استفاده از این کد، جمع کالاهای سبد باید حداقل ${money(discount.minSubtotal)} باشد.`);
  }
  const amount = discount.kind === "percent"
    ? Math.min(Math.floor(subtotal * discount.value / 100), discount.maxDiscount ?? subtotal)
    : Math.min(subtotal, discount.value);
  return { code: discount.code, amount };
}
