import Link from "next/link";
import { Link2, MapPin, Phone, ShoppingBag } from "lucide-react";
import type { Category } from "@/lib/shared";
import { CartLink, StoreCategories, StoreSearch } from "./store-interactions";
import { currentCustomer } from "@/lib/customer-auth";
import { parseEnamadEmbed } from "@/lib/enamad";
import { storeEnamad, storeFooter, storeName, storePhoneHref } from "@/lib/store-settings";

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
  const [name, { address, phone, socialLinks }, embed] = await Promise.all([storeName(), storeFooter(), storeEnamad()]);
  const enamad = parseEnamadEmbed(embed);
  return <footer className="store-footer"><div className="wrap footer-inner">
    <div><Brand name={name}/><p>فروشگاه آنلاین <bdi>{name}</bdi></p></div>
    {address && <section className="footer-section">
      <h2><MapPin size={18} aria-hidden="true"/> آدرس فروشگاه</h2>
      <address dir="auto">{address}</address>
    </section>}
    {phone && <section className="footer-section">
      <h2><Phone size={18} aria-hidden="true"/> شمارهٔ تماس</h2>
      <a href={storePhoneHref(phone)}><bdi dir="ltr">{phone}</bdi></a>
    </section>}
    {socialLinks.length > 0 && <section className="footer-section">
      <h2>شبکه‌های اجتماعی</h2>
      <ul className="footer-social">{socialLinks.map(({ name, url, logo }, index) => <li key={index}>
        <a href={url}>
          {logo ? <img src={logo} width={22} height={22} alt=""/> : <Link2 size={20} aria-hidden="true"/>}
          <bdi>{name}</bdi>
        </a>
      </li>)}</ul>
    </section>}
    {enamad && <div className="footer-section">
      <a href={enamad.href} target="_blank" rel="noopener" referrerPolicy="origin">
        <img src={enamad.src} alt="نماد اعتماد الکترونیکی" width={100} height={100} loading="lazy"
          referrerPolicy="origin" {...{ code: enamad.code }}/>
      </a>
    </div>}
  </div></footer>;
}
