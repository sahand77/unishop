import { IntegrationForm, StoreEnamadForm, StoreFooterForm, StoreNameForm } from "@/components/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { credentialSource } from "@/lib/integration-settings";
import { storeEnamad, storeFooter, storeName } from "@/lib/store-settings";

export default async function Settings() {
  await requireAdmin();
  const [name, footer, enamad, zarinpal, sms] = await Promise.all([
    storeName(), storeFooter(), storeEnamad(), credentialSource("zarinpal"), credentialSource("sms"),
  ]);
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
    <section className="panel flow">
      <h2>درگاه زرین‌پال</h2>
      <p>این شناسه برای پرداخت واقعی استفاده می‌شود.</p>
      <IntegrationForm integration="zarinpal" source={zarinpal}/>
    </section>
    <section className="panel flow">
      <h2>پنل پیامک (SMS.ir)</h2>
      <IntegrationForm integration="sms" source={sms}/>
    </section>
  </div>;
}
