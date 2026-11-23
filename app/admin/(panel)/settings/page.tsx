import { StoreFooterForm, StoreNameForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { storeFooter, storeName } from "@/lib/store-settings";

export default async function Settings() {
  await requireAdmin();
  const [name, footer] = await Promise.all([storeName(), storeFooter()]);
  return <div className="flow">
    <h1>تنظیمات فروشگاه</h1>
    <section className="panel flow"><StoreNameForm name={name}/></section>
    <section className="panel flow">
      <h2>فوتر فروشگاه</h2>
      <StoreFooterForm settings={footer}/>
    </section>
  </div>;
}
