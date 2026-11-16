import { RuleForm } from "@/components/rule-form";
import { categories } from "@/lib/catalog";
import { rules } from "@/lib/shipping";
import { fa,money } from "@/lib/shared";
import { requireAdmin } from "@/lib/auth";

export default async function Shipping() {
  await requireAdmin();
  const [list,groups] = await Promise.all([rules(),categories()]);
  return <div className="flow"><h1>قوانین ارسال</h1>
    <section className="panel flow"><h2>قوانین موجود</h2>
      <p className="muted">اولین قانون منطبق با سبد اعمال می‌شود. در اولویت برابر، قانون قدیمی‌تر ابتدا بررسی می‌شود.</p>
      {list.length ? list.map((item) => <details key={item.id} className="variant"><summary>
        {item.name}<span className="muted">اولویت {fa(item.priority)} · {money(item.fee)}</span></summary>
        <RuleForm rule={item} categories={groups}/></details>) : <p className="muted">هنوز روشی برای ارسال تعریف نشده است.</p>}
    </section>
    <section className="panel flow"><h2>افزودن قانون ارسال</h2><RuleForm categories={groups}/></section>
  </div>;
}