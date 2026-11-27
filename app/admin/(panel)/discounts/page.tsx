import { CopyDiscountCode, DiscountForm } from "@/components/discount-form";
import { requireAdmin } from "@/lib/auth";
import { discounts } from "@/lib/discounts";
import { fa, money } from "@/lib/shared";

export default async function DiscountsPage() {
  await requireAdmin();
  const list = await discounts();
  return <div className="flow">
    <h1>کدهای تخفیف</h1>
    <section className="panel flow">
      <h2>کدهای ثبت‌شده</h2>
      {list.length ? list.map(discount => <div key={discount.code} className="discount-list-item">
        <details className="variant">
          <summary><bdi>{discount.code}</bdi><span className="muted">
            {discount.kind === "percent" ? `${fa(discount.value)}٪` : money(discount.value)} · {discount.active ? "فعال" : "غیرفعال"}
          </span></summary>
          <DiscountForm discount={discount}/>
        </details>
        <CopyDiscountCode code={discount.code}/>
      </div>) : <p className="muted">هنوز کد تخفیفی ثبت نشده است.</p>}
    </section>
    <section className="panel flow"><h2>افزودن کد تخفیف</h2><DiscountForm/></section>
  </div>;
}
