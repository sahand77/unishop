import Link from "next/link";
import { Boxes, ClipboardList, FolderTree, LayoutDashboard, LogOut, Store, Truck } from "lucide-react";
import { signOut } from "@/app/actions";
import { Brand } from "./store-shell";

export function AdminShell({ children, username }: { children: React.ReactNode; username: string }) {
  const links = [
    { label:"پیشخوان",href:"/admin",icon:LayoutDashboard }, { label:"کالاها",href:"/admin/products",icon:Boxes },
    { label:"دسته‌بندی‌ها",href:"/admin/categories",icon:FolderTree }, { label:"قوانین ارسال",href:"/admin/shipping",icon:Truck },
    { label:"سفارش‌ها",href:"/admin/orders",icon:ClipboardList },
  ];
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Brand/><div className="admin-sidebar-title">پنل مدیریت</div>
      <nav aria-label="پنل مدیریت">{links.map(({ href,label,icon:Icon }) => <Link key={href} href={href}><Icon size={20}/>{label}</Link>)}</nav>
      <div className="admin-sidebar-bottom"><Link href="/"><Store size={19}/> نمایش فروشگاه</Link>
        <form action={signOut}><button type="submit"><LogOut size={19}/> خروج</button></form></div>
    </aside>
    <main className="admin-main"><div className="admin-top"><strong>مدیریت یونی‌شاپ</strong><bdi>{username}</bdi></div>{children}</main>
  </div>;
}