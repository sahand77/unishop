"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { basalamDraft, basalamId, productReels } from "@/lib/basalam";
import { currentCustomer } from "@/lib/customer-auth";
import { login, logout, requireAdmin } from "@/lib/auth";
import { saveCategory, saveProduct } from "@/lib/catalog";
import { cancelOrder, cartAvailability, customerSchema, order, quote, reserveOrder } from "@/lib/checkout";
import { db } from "@/lib/db";
import { saveDiscount, suggestDiscountCode, type DiscountDraft } from "@/lib/discounts";
import { parseEnamadEmbed } from "@/lib/enamad";
import { saveCredential, type Integration } from "@/lib/integration-settings";
import { gatewayLink, initiate, paymentMode, recheck, resumePayment, verify, validateGateway } from "@/lib/payment";
import { saveRule } from "@/lib/shipping";
import { saveStoreEnamad, saveStoreFooter, saveStoreName, storeEnamadTag, storeFooterSchema, storeFooterTag, storeNameTag } from "@/lib/store-settings";
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

export async function putStoreName(_previous: { text: string; error?: boolean }, form: FormData) {
  await requireAdmin();
  const input = z.string().trim().min(1).max(60).safeParse(form.get("name"));
  if (!input.success) return { text: "نام فروشگاه باید بین ۱ تا ۶۰ نویسه باشد.", error: true };

  try {
    await saveStoreName(input.data);
  } catch {
    return { text: "نام فروشگاه ذخیره نشد. دوباره تلاش کنید.", error: true };
  }
  updateTag(storeNameTag);
  return { text: "نام فروشگاه ذخیره شد." };
}

export async function putStoreFooter(_previous: { text: string; error?: boolean }, form: FormData) {
  await requireAdmin();
  const names = form.getAll("socialName");
  const urls = form.getAll("socialUrl");
  const logos = form.getAll("socialLogo");
  if (names.length !== urls.length || names.length !== logos.length) {
    return { text: "اطلاعات شبکه‌های اجتماعی کامل نیست.", error: true };
  }
  const input = storeFooterSchema.safeParse({
    address: form.get("address"),
    phone: form.get("phone"),
    socialLinks: names.map((name, index) => ({ name, url: urls[index], logo: logos[index] })),
  });
  if (!input.success) return { text: input.error.issues[0].message, error: true };

  try {
    await saveStoreFooter(input.data);
  } catch {
    return { text: "اطلاعات فوتر ذخیره نشد. دوباره تلاش کنید.", error: true };
  }
  updateTag(storeFooterTag);
  return { text: "اطلاعات فوتر ذخیره شد." };
}

export async function putStoreEnamad(_previous: { text: string; error?: boolean }, form: FormData) {
  await requireAdmin();
  const embed = form.get("enamad");
  if (typeof embed !== "string" || (embed.trim() && !parseEnamadEmbed(embed))) {
    return { text: "کد کامل اینماد را که شامل لینک و تصویر نماد است وارد کنید.", error: true };
  }
  try {
    await saveStoreEnamad(embed.trim());
  } catch {
    return { text: "کد اینماد ذخیره نشد. دوباره تلاش کنید.", error: true };
  }
  updateTag(storeEnamadTag);
  return { text: "تنظیمات اینماد ذخیره شد." };
}

export async function putIntegration(integration: Integration, _previous: { text: string; error?: boolean }, form: FormData) {
  await requireAdmin();
  if (integration !== "zarinpal" && integration !== "sms") return { text: "سرویس معتبر نیست.", error: true };
  const raw = form.get("credential");
  const value = typeof raw === "string" ? raw.trim() : "";
  if (integration === "zarinpal" && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    return { text: "شناسهٔ پذیرندهٔ زرین‌پال را با قالب UUID وارد کنید.", error: true };
  }
  if (integration === "sms" && !/^[!-~]{1,512}$/.test(value)) {
    return { text: "کلید API پنل پیامک را وارد کنید. کلید نباید فاصله داشته باشد.", error: true };
  }
  try {
    await saveCredential(integration, value);
  } catch {
    return { text: "تنظیمات سرویس ذخیره نشد. دوباره تلاش کنید.", error: true };
  }
  revalidatePath("/admin/settings");
  return { text: "تنظیمات سرویس ذخیره شد." };
}

export async function putCategory(_previous: { text: string; error?: boolean }, form: FormData) {
  await requireAdmin();
  try {
    await saveCategory(String(form.get("id") || ""),String(form.get("name") || ""),String(form.get("parentId") || ""));
  } catch (error) {
    return { text:message(error), error:true };
  }
  revalidatePath("/", "layout");
  return { text:"دسته ذخیره شد." };
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

export async function generateDiscountCode() {
  await requireAdmin();
  try {
    return { code: await suggestDiscountCode() };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function putDiscount(existingCode: string | null, fields: DiscountDraft) {
  await requireAdmin();
  try {
    await saveDiscount({
      code: existingCode ?? fields.code,
      pricing: { kind: fields.kind, value: fields.value },
      active: fields.active,
      minSubtotal: fields.minSubtotal,
      maxDiscount: fields.maxDiscount,
    }, existingCode !== null);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/admin/discounts");
  return {};
}

export async function retryPayment(id: string) {
  await requireAdmin();
  const item = await order(id);
  if (item && ["review","pending"].includes(item.status)) await recheck(item);
  revalidatePath(`/admin/orders/${id}`);
}

export async function cancelAdminOrder(id: string) {
  await requireAdmin();
  const adminPath = `/admin/orders/${id}`;
  if (!(await cancelOrder(id))) redirect(`${adminPath}?fulfillment=cancellation_unavailable`);
  revalidatePath("/account");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath(adminPath);
  redirect(adminPath);
}

export async function getCartAvailability(ids: unknown) {
  return cartAvailability(ids);
}

export async function getQuote(lines: unknown, province: unknown, city: unknown, discountCode?: unknown) {
  const location = z.string().trim().min(2).max(100).safeParse(city);
  if (!location.success) return { error: "شهر گیرنده را انتخاب کنید." };
  try {
    return { quote: await quote(lines,province,location.data,undefined,discountCode) };
  } catch (error) {
    return { error: message(error) };
  }
}

const displayed = z.object({
  subtotal: z.number().int(), shipping: z.number().int(), total: z.number().int(),
  discount: z.object({ code: z.string().max(32), amount: z.number().int().nonnegative() }).optional(),
});
type CheckoutResult = { url: string; orderId: string } | { changed: Quote } | { error: string };

export async function checkout(input: {
  lines: unknown; customer: unknown; attempt: string; shown: unknown; discountCode?: unknown;
}): Promise<CheckoutResult> {
  const customer = customerSchema.safeParse(input.customer);
  const shown = displayed.safeParse(input.shown);
  if (!customer.success) return { error: customer.error.issues[0].message };
  if (!shown.success) return { error: "مبلغ سفارش معتبر نیست. هزینهٔ ارسال را دوباره محاسبه کنید." };
  if (!z.uuid().safeParse(input.attempt).success) return { error: "شناسهٔ ثبت سفارش معتبر نیست." };
  try {
    const mode = paymentMode();
    if (shown.data.total > 0) await validateGateway(mode);
    const result = await reserveOrder({ customerId: (await currentCustomer())?.id, lines: input.lines, customer: customer.data,
      shown: shown.data, attempt: input.attempt, mode, discountCode: input.discountCode });
    if (result.changed) return { changed: result.changed };
    const item = result.fresh && result.order.status === "pending" ? await initiate(result.order) : result.order;
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
