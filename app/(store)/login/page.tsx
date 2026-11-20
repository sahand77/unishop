import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { CustomerLoginForm } from "@/components/customer-login-form";
import { storeName } from "@/lib/store-settings";
export default async function LoginPage() {
  if (await currentCustomer()) redirect("/account");
  return <main className="wrap narrow shop-main"><section className="panel flow"><h1>ورود یا ثبت‌نام</h1><p>با شماره موبایل وارد <bdi>{await storeName()}</bdi> شوید.</p><CustomerLoginForm/></section></main>;
}
