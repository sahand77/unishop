"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { login, logout, requireAdmin } from "@/lib/auth";
import { saveCategory, saveProduct } from "@/lib/catalog";
import { customerSchema, order, quote, reserveOrder } from "@/lib/checkout";
import { db } from "@/lib/db";
import { gatewayLink, initiate, paymentMode, recheck, validateGateway } from "@/lib/payment";
import { saveRule } from "@/lib/shipping";
import type { Quote } from "@/lib/shared";

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
    saveCategory(String(form.get("id") || ""),String(form.get("name") || ""));
  } catch (error) {
    return message(error);
  }
  revalidatePath("/", "layout");
  return "دسته ذخیره شد.";
}

export async function putProduct(input: unknown) {
  await requireAdmin();
  try {
    const id = saveProduct(input);
    revalidatePath("/", "layout");
    return { id };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function putRule(input: unknown) {
  await requireAdmin();
  try {
    saveRule(input);
    revalidatePath("/admin/shipping");
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

export async function removeRule(id: string) {
  await requireAdmin();
  db().prepare("DELETE FROM shipping WHERE id=?").run(id);
  revalidatePath("/admin/shipping");
}

export async function retryPayment(id: string) {
  await requireAdmin();
  const item = order(id);
  if (item && ["review","pending"].includes(item.status)) await recheck(item);
  revalidatePath(`/admin/orders/${id}`);
}

export async function getQuote(lines: unknown, province: unknown) {
  try {
    return { quote: quote(lines,province) };
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
  if (!customer.success || !shown.success || !z.uuid().safeParse(input.attempt).success) {
    return { error: "نام، موبایل، شهر، نشانی و کدپستی را بررسی کنید." };
  }
  try {
    const mode = paymentMode();
    validateGateway(mode);
    const result = reserveOrder({ lines: input.lines, customer: customer.data, shown: shown.data, attempt: input.attempt, mode });
    if (result.changed) return { changed: result.changed };
    const item = result.fresh ? await initiate(result.order) : result.order;
    return { url: ["pending","review"].includes(item.status) ? gatewayLink(item) : `/orders/${item.id}?token=${item.secret}`, orderId: item.id };
  } catch (error) {
    return { error: message(error) };
  }
}