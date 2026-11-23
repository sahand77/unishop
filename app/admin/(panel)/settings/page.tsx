import { StoreEnamadForm, StoreFooterForm, StoreNameForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { storeEnamad, storeFooter, storeName } from "@/lib/store-settings";

export default async function Settings() {
  await requireAdmin();
  const [name, footer, enamad] = await Promise.all([storeName(), storeFooter(), storeEnamad()]);
  return <div className="flow">
    <h1>تنظیمات فروشگاه</h1>
    <section className="panel flow"><StoreNameForm name={name}/></section>
    <section className="panel flow">
      <h2>فوتر فروشگاه</h2>
      <StoreFooterForm settings={footer}/>
    </section>
    <section className="panel flow">
      <h2>اینماد</h2>
      <StoreEnamadForm embed={enamad}/>
    </section>
  </div>;
}
