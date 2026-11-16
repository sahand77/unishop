import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";

export const metadata: Metadata = {
  title: { default: "یونی‌شاپ | فروشگاه آنلاین", template: "%s | یونی‌شاپ" },
  description: "فروشگاه آنلاین یونی‌شاپ برای خرید کالاهای روزمره",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl"><body><CartProvider>{children}</CartProvider></body></html>;
}