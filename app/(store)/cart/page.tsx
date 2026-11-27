import Link from "next/link";
import { CartScreen } from "@/components/store-interactions";
import { currentCustomer } from "@/lib/customer-auth";

export default async function CartPage() {
  const customerId = (await currentCustomer())?.id ?? null;
  return <main className="wrap interior flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/">فروشگاه</Link><span>سبد خرید</span></nav>
    <h1>سبد خرید</h1><CartScreen key={customerId ?? "guest"} customerId={customerId}/></main>;
}
