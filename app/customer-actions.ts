"use server";
import { redirect } from "next/navigation";
import { requestCode, verifyCode } from "@/lib/customer-login";
import { logoutCustomer, setCustomerSession } from "@/lib/customer-auth";

export type LoginState = { id?: string; mobile?: string; error?: string };
export async function customerLogin(previous: LoginState, form: FormData): Promise<LoginState> {
  if (form.get("step") === "send") {
    try { return await requestCode(String(form.get("mobile") || "")); }
    catch (error) { return { ...previous, error: error instanceof Error ? error.message : "ارسال کد انجام نشد." }; }
  }
  let token: string | null;
  try { token = await verifyCode(String(form.get("id") || ""), String(form.get("code") || "")); }
  catch { return { ...previous, error: "ورود انجام نشد. دوباره تلاش کنید." }; }
  if (!token) return { ...previous, error: "کد نادرست یا منقضی شده است. کد تازه درخواست کنید." };
  await setCustomerSession(token);
  redirect("/account");
}
export async function customerLogout() {
  await logoutCustomer();
  redirect("/login");
}
