import Link from "next/link";
import { Box, Settings2, ShoppingBag } from "lucide-react";
import type { Category } from "@/lib/shared";
import { CartLink, StoreCategories, StoreSearch } from "./store-interactions";

export function Brand() {
  return <Link href="/" className="brand" aria-label="یونی‌شاپ، صفحهٔ اصلی">
    <span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.3}/></span><span>یونی<span className="brand-accent">‌شاپ</span></span>
  </Link>;
}

export function StoreHeader({ groups }: { groups: Category[] }) {
  return <header className="store-header"><div className="wrap header-inner">
    <Brand/>
    <StoreCategories groups={groups}/>
    <StoreSearch/>
    <CartLink/>
  </div></header>;
}

export function StoreFooter() {
  return <footer className="store-footer"><div className="wrap footer-inner">
    <div><Brand/><p>فروشگاه آنلاین یونی‌شاپ</p></div>
    <div className="footer-links"><Link href="/#products"><Box size={17}/> محصولات</Link><Link href="/admin"><Settings2 size={17}/> پنل مدیریت</Link></div>
  </div></footer>;
}