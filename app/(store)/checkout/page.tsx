import Link from "next/link";
import { CheckoutScreen } from "@/components/store-interactions";

export default function CheckoutPage() {
  return <main className="wrap interior flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/cart">سبد خرید</Link><span>ثبت سفارش</span></nav>
    <h1>ثبت سفارش</h1><CheckoutScreen/></main>;
}