import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { Brand } from "@/components/store-shell";
import { LoginForm } from "@/components/admin-forms";
import { storeName } from "@/lib/store-settings";
export default async function AdminLogin() {
  if (await currentAdmin()) redirect("/admin");
  return <main className="wrap narrow login flow"><Brand name={await storeName()}/>
    <section className="panel flow"><h1>ورود به پنل مدیریت</h1><LoginForm/></section>
  </main>;
}
