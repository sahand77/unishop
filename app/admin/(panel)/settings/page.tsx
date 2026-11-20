import { StoreNameForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { storeName } from "@/lib/store-settings";

export default async function Settings() {
  await requireAdmin();
  return <div className="flow">
    <h1>تنظیمات فروشگاه</h1>
    <section className="panel flow"><StoreNameForm name={await storeName()}/></section>
  </div>;
}
