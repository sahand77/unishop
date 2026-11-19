"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { basalamDraft, basalamId, productReels } from "@/lib/basalam";
import { currentCustomer } from "@/lib/customer-auth";
import { login, logout, requireAdmin } from "@/lib/auth";
import { saveCategory, saveProduct } from "@/lib/catalog";
import { customerSchema, order, quote, reserveOrder } from "@/lib/checkout";
import { db } from "@/lib/db";
import { gatewayLink, initiate, paymentMode, recheck, resumePayment, verify, validateGateway } from "@/lib/payment";
import { saveRule } from "@/lib/shipping";
import { customerPaymentLabels, type Quote } from "@/lib/shared";

function message(error: unknown) {
  if (error && typeof error === "object" && "code" in error) return "ذخیره انجام نشد. مقادیر واردشده را بررسی کنید.";
  return error instanceof Error ? error.message : "عملیات انجام نشد.";
}

export async function signIn(_previous: string, form: FormData) {
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!(await login(username,password))) return "نام کاربری یا رمز عبور نادرست است.";
  redirect("/admin");
}

export async function signOut() {
  await logout();
  redirect("/admin/login");
}

export async function putCategory(_previous: string, form: FormData) {
  await requireAdmin();
  try {
    await saveCategory(String(form.get("id") || ""),String(form.get("name") || ""));
  } catch (error) {
    return message(error);
  }
  revalidatePath("/", "layout");
  return "دسته ذخیره شد.";
}

export async function previewBasalam(link: string) {
  await requireAdmin();
  const id = basalamId(link);
  if (!id) return { error:"لینک صفحهٔ کالای باسلام را وارد کنید." };
  try {
    const response = await fetch(`https://core.basalam.com/v3/products/${id}`, {
      cache:"no-store", redirect:"error", signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) return { error:"دریافت کالا از باسلام انجام نشد. لینک را بررسی کنید." };
    const product = await response.json();
    const page = await fetch(new URL(new URL(link).pathname, "https://basalam.com"), {
      cache:"no-store", redirect:"error", signal:AbortSignal.timeout(15000)
    });
    if (!page.ok) return { error:"دریافت گالری کالا از باسلام انجام نشد. دوباره تلاش کنید." };
    return { draft:basalamDraft(product, productReels(await page.text(), id)) };
  } catch {
    return { error:"اطلاعات کالا از باسلام دریافت نشد. دوباره تلاش کنید." };
  }
}

export async function putProduct(input: unknown) {
  await requireAdmin();
  try {
    const id = await saveProduct(input);
    revalidatePath("/", "layout");
    return { id };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function putRule(input: unknown) {
  await requireAdmin();
  try {
    await saveRule(input);
    revalidatePath("/admin/shipping");
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

export async function removeRule(id: string) {
  await requireAdmin();
  await db().query("DELETE FROM shipping WHERE id=$1",[id]);
  revalidatePath("/admin/shipping");
}

export async function retryPayment(id: string) {
  await requireAdmin();
  const item = await order(id);
  if (item && ["review","pending"].includes(item.status)) await recheck(item);
  revalidatePath(`/admin/orders/${id}`);
}

export async function getQuote(lines: unknown, province: unknown) {
  try {
    return { quote: await quote(lines,province) };
  } catch (error) {
    return { error: message(error) };
  }
}

const displayed = z.object({ subtotal: z.number().int(), shipping: z.number().int(), total: z.number().int() });
type CheckoutResult = { url: string; orderId: string } | { changed: Quote } | { error: string };

export async function checkout(input: {
  lines: unknown; customer: unknown; attempt: string; shown: unknown;
}): Promise<CheckoutResult> {
  const customer = customerSchema.safeParse(input.customer);
  const shown = displayed.safeParse(input.shown);
  if (!customer.success) return { error: customer.error.issues[0].message };
  if (!shown.success) return { error: "مبلغ سفارش معتبر نیست. هزینهٔ ارسال را دوباره محاسبه کنید." };
  if (!z.uuid().safeParse(input.attempt).success) return { error: "شناسهٔ ثبت سفارش معتبر نیست." };
  try {
    const mode = paymentMode();
    validateGateway(mode);
    const result = await reserveOrder({ customerId: (await currentCustomer())?.id, lines: input.lines, customer: customer.data, shown: shown.data, attempt: input.attempt, mode });
    if (result.changed) return { changed: result.changed };
    const item = result.fresh ? await initiate(result.order) : result.order;
    return { url: ["pending","review"].includes(item.status) ? gatewayLink(item) : `/orders/${item.id}?token=${item.secret}`, orderId: item.id };
  } catch (error) {
    return { error: message(error) };
  }
}
export async function customerPayment(id: string, token: string | null, _previous: string, form: FormData) {
  const item = await order(id);
  if (!item || !(token ? item.secret === token : item.customer_id && item.customer_id === (await currentCustomer())?.id)) {
    return "به این سفارش دسترسی ندارید.";
  }
  const action = form.get("action");
  if (action !== "check" && action !== "pay") return "عملیات معتبر نیست.";
  let result;
  try {
    result = action === "pay" ? await resumePayment(item) : await verify(item);
  } catch (error) {
    return message(error);
  }
  revalidatePath("/account");
  revalidatePath(`/orders/${id}`);
  if (action === "pay" && result.authority && ["pending", "review"].includes(result.status)) redirect(gatewayLink(result));
  return `وضعیت پرداخت: ${customerPaymentLabels[result.status]}. ${result.message || ""}`;
}
