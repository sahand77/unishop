import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { transaction, db } from "./db";
import { digits, mobileNumber, sendCode } from "./sms";

export const sessionHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const customerLifetime = 60 * 60 * 24 * 30;

export async function requestCode(input: string) {
  const mobile = mobileNumber(input);
  const id = randomUUID();
  const code = String(randomInt(100000, 1000000));
  const now = Date.now();
  await transaction(async client => {
    await client.query("DELETE FROM login_codes WHERE created<$1", [now - 86400000]);
    const { rows: [limits] } = await client.query<{ recent: string; hourly: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE mobile=$1 AND created>$2) AS recent,
      COUNT(*) FILTER (WHERE mobile=$1) AS hourly, COUNT(*) AS total FROM login_codes WHERE created>$3`,
      [mobile, now - 60000, now - 3600000]);
    if (Number(limits.recent) || Number(limits.hourly) >= 5 || Number(limits.total) >= 100) {
      throw new Error("تعداد درخواست‌ها زیاد است. برای ارسال دوباره کمی صبر کنید.");
    }
    await client.query("UPDATE login_codes SET used=true WHERE mobile=$1", [mobile]);
    await client.query("INSERT INTO login_codes (id,mobile,hash,expires,created) VALUES ($1,$2,$3,$4,$5)",
      [id, mobile, scryptSync(code, id, 32).toString("hex"), now + 120000, now]);
  });
  await sendCode(mobile, code);
  await db().query("UPDATE login_codes SET ready=true WHERE id=$1", [id]);
  // TODO: بعد از پایان تست محلی، این لاگ و تنظیم شمارهٔ تست را حذف کنید.
  if (process.env.SMS_DEBUG_MOBILE === mobile && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(process.env.APP_URL || "")) {
    console.info("[sms-debug] OTP:", code);
  }
  return { id, mobile };
}

export async function verifyCode(id: string, input: string) {
  const code = digits(input.trim());
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{6}$/.test(code)) return null;
  return transaction(async client => {
    const { rows: [row] } = await client.query("SELECT * FROM login_codes WHERE id=$1 FOR UPDATE", [id]);
    if (!row || !row.ready || row.used || Number(row.expires) <= Date.now() || row.attempts >= 5) return null;
    await client.query("UPDATE login_codes SET attempts=attempts+1 WHERE id=$1", [id]);
    if (!timingSafeEqual(scryptSync(code, id, 32), Buffer.from(row.hash, "hex"))) return null;
    await client.query("UPDATE login_codes SET used=true WHERE id=$1", [id]);
    const { rows: [customer] } = await client.query("INSERT INTO customers (id,mobile) VALUES ($1,$2) ON CONFLICT (mobile) DO UPDATE SET mobile=EXCLUDED.mobile RETURNING id", [randomUUID(), row.mobile]);
    const token = randomBytes(32).toString("hex");
    await client.query("DELETE FROM customer_sessions WHERE expires<=$1", [Date.now()]);
    await client.query("INSERT INTO customer_sessions (token,customer_id,expires) VALUES ($1,$2,$3)", [sessionHash(token), customer.id, Date.now() + customerLifetime * 1000]);
    return token;
  });
}
