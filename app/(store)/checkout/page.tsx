import Link from "next/link";
import { CheckoutScreen } from "@/components/store-interactions";

import { currentCustomer } from "@/lib/customer-auth";
import { addresses } from "@/lib/profile";
export default async function CheckoutPage() {
  const customer = await currentCustomer();
  const saved = customer ? await addresses(customer.id) : [];
  return <main className="wrap interior flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/cart">سبد خرید</Link><span>ثبت سفارش</span></nav>
    <h1>ثبت سفارش</h1><CheckoutScreen key={customer?.id ?? "guest"} customerId={customer?.id ?? null} saved={saved}/></main>;
}
