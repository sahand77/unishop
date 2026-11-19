import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { customerLogout } from "@/app/customer-actions";
export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer) redirect("/login");
  return <main className="wrap narrow shop-main"><section className="panel flow"><h1>حساب کاربری</h1><p>با شمارهٔ <bdi>{customer.mobile}</bdi> وارد شده‌اید.</p><form action={customerLogout}><button className="button">خروج از حساب</button></form></section></main>;
}
