"use client";
import { AmountInput } from "./amount-input";
import { useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { putRule, removeRule } from "@/app/actions";
import { categoryOptions } from "@/lib/category-tree";
import { fa, provinces, type Category, type ShippingRule } from "@/lib/shared";
import { PendingButton } from "./pending-button";

const blank: ShippingRule = { id:"",name:"",priority:100,fee:0,provinces:[],categories:[],
  minQuantity:null,maxQuantity:null,minWeight:null,maxWeight:null,minSubtotal:null,maxSubtotal:null };

export function RuleForm({ rule,categories }: { rule?: ShippingRule; categories: Category[] }) {
  const [value,setValue] = useState(rule || blank);
  const [feedback,setFeedback] = useState<{ error?: string; success?: string }>({});
  const [pending,start] = useTransition();
  const [removing,setRemoving] = useState(false);
  const bound = (name: "minQuantity" | "maxQuantity" | "minWeight" | "maxWeight" | "minSubtotal" | "maxSubtotal", label: string) =>
    <label>{label}{name === "minSubtotal" || name === "maxSubtotal" ? <AmountInput value={value[name]} placeholder="بدون محدودیت" onChange={amount => setValue({...value, [name]: amount})}/> : <input type="number" min={0} max={1000000000} value={value[name] ?? ""} placeholder="بدون محدودیت"
      onChange={(event) => setValue({ ...value,[name]:event.target.value === "" ? null : Number(event.target.value) })}/>}</label>;
  function toggle(key: "categories" | "provinces", member: string) {
    setValue({ ...value,[key]:value[key].includes(member) ? value[key].filter((item) => item !== member) : [...value[key],member] });
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setRemoving(false); setFeedback({});
    start(async () => {
      try {
        const result = await putRule(value);
        if (result.error) { setFeedback({ error:result.error }); return; }
        if (!rule) setValue(blank);
        setFeedback({ success:"قانون ارسال ذخیره شد." });
      } catch { setFeedback({ error:"ارتباط با فروشگاه برقرار نشد." }); }
    });
  }
  function remove() {
    if (!rule || pending || !window.confirm("این قانون ارسال حذف شود؟")) return;
    setRemoving(true); setFeedback({});
    start(async () => {
      try { await removeRule(rule.id); }
      catch { setFeedback({ error:"حذف قانون ارسال انجام نشد. دوباره تلاش کنید." }); }
    });
  }
  return <form className="flow" onSubmit={submit}><fieldset disabled={pending} className="flow">
    <div className="form-grid">
      <label>نام قانون<input required maxLength={80} value={value.name} onChange={(event) => setValue({ ...value,name:event.target.value })}/></label>
      <label>اولویت<input type="number" min={0} required value={value.priority} onChange={(event) => setValue({ ...value,priority:Number(event.target.value) })}/></label>
      <label>هزینهٔ ارسال به تومان<AmountInput required value={value.fee} onChange={fee => setValue({...value, fee: fee ?? 0})}/></label>
    </div>
    <p className="muted">عدد کمتر زودتر بررسی می‌شود. گزینه‌های خالی یعنی بدون محدودیت.</p>
    <details className="variant"><summary>استان‌ها {value.provinces.length > 0 && `(${fa(value.provinces.length)})`}</summary>
      <div className="checks">{provinces.map((province) => <label key={province} className="check">
        <input type="checkbox" checked={value.provinces.includes(province)} onChange={() => toggle("provinces",province)}/>{province}</label>)}</div>
    </details>
    <details className="variant"><summary>دسته‌بندی‌ها {value.categories.length > 0 && `(${fa(value.categories.length)})`}</summary>
      {categories.length ? <div className="checks">{categoryOptions(categories).map(item => <label key={item.id} className="check">
        <input type="checkbox" checked={value.categories.includes(item.id)} onChange={() => toggle("categories",item.id)}/>{item.label}</label>)}</div>
        : <p className="muted">ابتدا دسته‌بندی ایجاد کنید.</p>}
    </details>
    <details className="variant"><summary>بازهٔ تعداد، وزن و مبلغ</summary><div className="form-grid">
      {bound("minQuantity","کمترین تعداد")}{bound("maxQuantity","بیشترین تعداد")}
      {bound("minWeight","کمترین وزن به گرم")}{bound("maxWeight","بیشترین وزن به گرم")}
      {bound("minSubtotal","کمترین مبلغ به تومان")}{bound("maxSubtotal","بیشترین مبلغ به تومان")}
    </div></details>
    {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
    {feedback.success && <p className="notice" role="status">{feedback.success}</p>}
    <div className="editor-buttons">
      <PendingButton type="submit" className="button primary" busy={pending && !removing} pendingLabel="در حال ذخیره…"><Save size={16}/> ذخیرهٔ قانون</PendingButton>
      {rule && <PendingButton className="button danger" type="button" busy={pending && removing} pendingLabel="در حال حذف…" onClick={remove}>
        <Trash2 size={16}/> حذف قانون
      </PendingButton>}
    </div>
  </fieldset></form>;
}
