import { StoreHeader,StoreFooter } from "@/components/store-shell";
import { categories } from "@/lib/catalog";
import "../store.css";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return <div className="store-layout"><StoreHeader groups={await categories()}/>{children}<StoreFooter/></div>;
}