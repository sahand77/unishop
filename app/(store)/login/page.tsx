import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { CustomerLoginForm } from "@/components/customer-login-form";
export default async function LoginPage() {
  if (await currentCustomer()) redirect("/account");
  return <main className="wrap narrow shop-main"><section className="panel flow"><h1>ورود یا ثبت‌نام</h1><p>با شماره موبایل وارد یونی‌شاپ شوید.</p><CustomerLoginForm/></section></main>;
}
