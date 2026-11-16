import Link from "next/link";
import { CartScreen } from "@/components/store-interactions";

export default function CartPage() {
  return <main className="wrap interior flow"><nav className="breadcrumbs" aria-label="مسیر صفحه"><Link href="/">فروشگاه</Link><span>سبد خرید</span></nav>
    <h1>سبد خرید</h1><CartScreen/></main>;
}