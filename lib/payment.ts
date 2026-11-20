import { randomUUID } from "node:crypto";
import { db } from "./db";
import { order, reopenPayment, settle, type Mode, type Order } from "./checkout";

export function paymentMode(): Mode {
  const mode = process.env.PAYMENT_MODE || "sandbox";
  if (mode !== "sandbox" && mode !== "live" && mode !== "simulator") {
    throw new Error("حالت درگاه پرداخت معتبر نیست.");
  }
  return mode;
}

function merchant(mode: Mode) {
  return mode === "live"
    ? process.env.ZARINPAL_MERCHANT_ID
    : process.env.ZARINPAL_SANDBOX_MERCHANT_ID ?? "00000000-0000-4000-8000-000000000000";
}

function origin(mode: Mode) {
  const url = new URL(process.env.APP_URL || "http://127.0.0.1:3000");
  if (mode === "live" && (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    throw new Error("برای پرداخت واقعی، نشانی بازگشت HTTPS پذیرنده را تنظیم کنید.");
  }
  return url.origin;
}

export function validateGateway(mode: Mode) {
  origin(mode);
  if (mode !== "simulator" && !merchant(mode)) throw new Error("شناسهٔ پذیرندهٔ درگاه تنظیم نشده است.");
}

const sandbox = "https://sandbox.zarinpal.com";
const callbackPath = "/payment/return";
export const receiptPath = (item: Order) => `/orders/${item.id}?token=${item.secret}`;

export function gatewayLink(item: Order) {
  if (!item.authority) return receiptPath(item);
  if (item.mode === "simulator") return `/payment/simulator/${item.id}?token=${item.secret}`;
  const gateway = item.mode === "sandbox" ? sandbox : "https://www.zarinpal.com";
  return `${gateway}/pg/StartPay/${encodeURIComponent(item.authority)}`;
}

type GatewayPayload = { code?: number; authority?: string; ref_id?: string | number };
async function call(mode: Mode, endpoint: "request" | "verify", fields: Record<string, string | number>) {
  const host = mode === "sandbox" ? sandbox : "https://api.zarinpal.com";
  const response = await fetch(`${host}/pg/v4/payment/${endpoint}.json`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ merchant_id: merchant(mode), ...fields }),
    signal: AbortSignal.timeout(12000), cache: "no-store",
  });
  if (response.status >= 500 || response.status === 429) throw new Error("درگاه در دسترس نیست.");
  const result = await response.json() as { data?: GatewayPayload; errors?: GatewayPayload };
  const code = result.data?.code ?? result.errors?.code;
  if (typeof code !== "number") throw new Error("پاسخ درگاه قابل خواندن نیست.");
  return { ...result.data, code };
}

export async function initiate(item: Order) {
  const finish = (status: Order["status"], note: string, reference: string | null = null) =>
    settle(item.id, status, note, reference, item);
  try {
    validateGateway(item.mode);
    const callback = new URL(callbackPath, origin(item.mode));
    callback.searchParams.set("id",item.id);
    callback.searchParams.set("token",item.secret);
    const response = item.mode === "simulator"
      ? { code: 100, authority: `sim-${randomUUID()}` }
      : await call(item.mode,"request",{ amount: item.amount, currency: "IRR",
          callback_url: callback.href, description: `سفارش یونی‌شاپ ${item.id.slice(0,8)}` });
    if (response.code !== 100) return finish("failed",`درگاه درخواست را نپذیرفت. کد ${response.code}`);
    if (!response.authority || !/^[A-Za-z0-9-]{1,100}$/.test(response.authority)) {
      throw new Error("شناسهٔ معتبر پرداخت دریافت نشد.");
    }
    await db().query("UPDATE orders SET authority=$1,message=NULL WHERE id=$2 AND status='pending' AND authority IS NULL AND request_started=$3",
      [response.authority,item.id,item.request_started]);
    return (await order(item.id))!;
  } catch {
    return finish("review","درخواست پرداخت بی‌پاسخ ماند. از پنل دوباره بررسی کنید.");
  }
}

export async function recheck(item: Order) {
  if (item.authority) return verify(item);
  const now = Date.now();
  const claimed = await db().query(`UPDATE orders SET status='pending',request_started=$1 WHERE id=$2 AND authority IS NULL
    AND (status='review' OR (status='pending' AND request_started<=$3))`,[now,item.id,now-30_000]);
  return claimed.rowCount ? initiate({ ...item, request_started: now }) : (await order(item.id))!;
}

export async function verify(item: Order, returnedStatus?: string) {
  const finish = (status: Order["status"], note: string, reference: string | null = null) =>
    settle(item.id, status, note, reference, item);
  if (!item.authority || !["review","pending"].includes(item.status)) return (await order(item.id))!;
  if (item.mode === "simulator") {
    if (returnedStatus === "OK") return finish("paid","پرداخت شبیه‌سازی شد.",`TEST-${item.id.slice(0,8)}`);
    if (returnedStatus === "NOK") return finish("canceled","پرداخت شبیه‌سازی‌شده لغو شد.");
    return finish("review","در انتظار انتخاب نتیجه در درگاه شبیه‌ساز.");
  }
  try {
    validateGateway(item.mode);
    const result = await call(item.mode,"verify",{ amount: item.amount, authority: item.authority });
    if (result.code === 100 || result.code === 101) {
      return finish("paid","پرداخت تأیید شد.",result.ref_id == null ? null : String(result.ref_id));
    }
    if (result.code === -52 || (result.code === -51 && returnedStatus === "NOK")) {
      return finish(returnedStatus === "NOK" ? "canceled" : "failed",`پرداخت ناموفق بود. کد ${result.code}`);
    }
    return finish("review",`تأیید قطعی دریافت نشد. کد ${result.code}`);
  } catch {
    return finish("review","ارتباط با درگاه برقرار نشد. دوباره بررسی کنید.");
  }
}
export async function resumePayment(item: Order) {
  if (item.status === "paid" || item.fulfillment_status === "canceled") return item;
  const checked = ["failed", "canceled"].includes(item.status) ? item
    : item.authority ? await verify(item) : await recheck(item);
  if (checked.status === "failed" || checked.status === "canceled") {
    const reopened = await reopenPayment(checked.id);
    return reopened ? initiate(reopened) : (await order(checked.id))!;
  }
  return checked;
}
