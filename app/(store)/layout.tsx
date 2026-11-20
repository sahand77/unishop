import type { Metadata } from "next";
import { StoreHeader,StoreFooter } from "@/components/store-shell";
import { categories } from "@/lib/catalog";
import { storeName } from "@/lib/store-settings";
import "../store.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = await storeName();
  return {
    title: { default: `${name} | فروشگاه آنلاین`, template: `%s | ${name}` },
    description: `فروشگاه آنلاین ${name} برای خرید کالاهای روزمره`,
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return <div className="store-layout"><StoreHeader groups={await categories()}/>{children}<StoreFooter/></div>;
}
