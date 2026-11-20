import Link from "next/link";
import { Box, Settings2, ShoppingBag } from "lucide-react";
import type { Category } from "@/lib/shared";
import { CartLink, StoreCategories, StoreSearch } from "./store-interactions";
import { currentCustomer } from "@/lib/customer-auth";
import { storeName } from "@/lib/store-settings";

export function Brand({ name }: { name: string }) {
  const accentStart = name.match(/[^\s\u200c]+[\s\u200c]*$/u)?.index ?? 0;
  return <Link href="/" className="brand" aria-label={`${name}، صفحهٔ اصلی`}>
    <span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.3}/></span>
    <bdi className="brand-name">{name.slice(0, accentStart)}<span className="brand-accent">{name.slice(accentStart)}</span></bdi>
  </Link>;
}

export async function StoreHeader({ groups }: { groups: Category[] }) {
  const [customer, name] = await Promise.all([currentCustomer(), storeName()]);
  return <header className="store-header"><div className="wrap header-inner">
    <Brand name={name}/>
    <StoreCategories groups={groups}/>
    <StoreSearch storeName={name}/>
    <CartLink/>
    <Link href={customer ? "/account" : "/login"}>{customer ? "حساب کاربری" : "ورود / ثبت‌نام"}</Link>
  </div></header>;
}

export async function StoreFooter() {
  const name = await storeName();
  return <footer className="store-footer"><div className="wrap footer-inner">
    <div><Brand name={name}/><p>فروشگاه آنلاین <bdi>{name}</bdi></p></div>
    <div className="footer-links"><Link href="/#products"><Box size={17}/> محصولات</Link><Link href="/admin"><Settings2 size={17}/> پنل مدیریت</Link></div>
  </div></footer>;
}
