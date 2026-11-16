import { StoreHeader,StoreFooter } from "@/components/store-shell";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <div className="store-layout"><StoreHeader/>{children}<StoreFooter/></div>;
}