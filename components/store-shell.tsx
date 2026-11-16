import Link from "next/link";
import { Box, Settings2, ShoppingBag } from "lucide-react";
import { CartLink } from "./store-interactions";

export function Brand() {
  return <Link href="/" className="brand" aria-label="یونی‌شاپ، صفحهٔ اصلی">
    <span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.3}/></span><span>یونی<span className="brand-accent">‌شاپ</span></span>
  </Link>;
}

export function StoreHeader() {
  return <header className="store-header"><div className="wrap header-inner">
    <Brand/>
    <nav aria-label="فروشگاه"><Link href="/">خانه</Link><Link href="/#products">محصولات</Link></nav>
    <div className="header-utilities"><Link className="icon-link admin-link" href="/admin" aria-label="پنل مدیریت" title="پنل مدیریت"><Settings2 size={19}/></Link><CartLink/></div>
  </div></header>;
}

export function StoreFooter() {
  return <footer className="store-footer"><div className="wrap footer-inner">
    <div><Brand/><p>خرید آنلاین، ساده و راحت.</p></div>
    <div className="footer-links"><Link href="/#products"><Box size={17}/> محصولات</Link><Link href="/admin"><Settings2 size={17}/> پنل مدیریت</Link></div>
  </div></footer>;
}