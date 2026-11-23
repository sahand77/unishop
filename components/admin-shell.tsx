import Link from "next/link";
import { Boxes, ClipboardList, FolderTree, LayoutDashboard, LogOut, Settings2, Store, Truck } from "lucide-react";
import { signOut } from "@/app/actions";
import { storeName } from "@/lib/store-settings";
import { Brand } from "./store-shell";
import { PendingSubmitButton } from "./pending-button";

export async function AdminShell({ children, username }: { children: React.ReactNode; username: string }) {
  const name = await storeName();
  const links = [
    { label:"پیشخوان",href:"/admin",icon:LayoutDashboard }, { label:"کالاها",href:"/admin/products",icon:Boxes },
    { label:"دسته‌بندی‌ها",href:"/admin/categories",icon:FolderTree }, { label:"قوانین ارسال",href:"/admin/shipping",icon:Truck },
    { label:"سفارش‌ها",href:"/admin/orders",icon:ClipboardList }, { label:"تنظیمات",href:"/admin/settings",icon:Settings2 },
  ];
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Brand name={name}/><div className="admin-sidebar-title">پنل مدیریت</div>
      <nav aria-label="پنل مدیریت">{links.map(({ href,label,icon:Icon }) => <Link key={href} href={href}><Icon size={20}/>{label}</Link>)}</nav>
      <div className="admin-sidebar-bottom"><Link href="/"><Store size={19}/> نمایش فروشگاه</Link>
        <form action={signOut}><PendingSubmitButton pendingLabel="در حال خروج…"><LogOut size={19}/> خروج</PendingSubmitButton></form></div>
    </aside>
    <main className="admin-main"><div className="admin-top"><strong>مدیریت <bdi>{name}</bdi></strong><bdi>{username}</bdi></div>{children}</main>
  </div>;
}
