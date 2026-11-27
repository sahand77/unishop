"use client";
import { AmountInput } from "./amount-input";
import { useState, useTransition } from "react";
import { Save, Trash2, X } from "lucide-react";
import { putRule, removeRule } from "@/app/actions";
import { categoryOptions } from "@/lib/category-tree";
import { citiesForProvince } from "@/lib/iran-cities";
import { fa, provinces, type Category, type ShippingRule } from "@/lib/shared";
import { PendingButton } from "./pending-button";

const blank: ShippingRule = { id:"",name:"",priority:100,fee:0,provinces:[],categories:[],
  minQuantity:null,maxQuantity:null,minWeight:null,maxWeight:null,minSubtotal:null,maxSubtotal:null };

export function RuleForm({ rule,categories }: { rule?: ShippingRule; categories: Category[] }) {
  const [value,setValue] = useState(rule || blank);
  const [locationProvince,setLocationProvince] = useState("");
  const [locationCity,setLocationCity] = useState("");
  const [feedback,setFeedback] = useState<{ error?: string; success?: string }>({});
  const [pending,start] = useTransition();
  const [removing,setRemoving] = useState(false);
  const bound = (name: "minQuantity" | "maxQuantity" | "minWeight" | "maxWeight" | "minSubtotal" | "maxSubtotal", label: string) =>
    <label>{label}{name === "minSubtotal" || name === "maxSubtotal" ? <AmountInput value={value[name]} placeholder="بدون محدودیت" onChange={amount => setValue({...value, [name]: amount})}/> : <input type="number" min={0} max={1000000000} value={value[name] ?? ""} placeholder="بدون محدودیت"
      onChange={(event) => setValue({ ...value,[name]:event.target.value === "" ? null : Number(event.target.value) })}/>}</label>;
  const cities = value.cities ?? [];
  const availableCities = citiesForProvince(locationProvince);
  const destinationCount = value.provinces.length + cities.length;
  const alreadyAdded = locationCity ? cities.some(({ province,city }) => province === locationProvince && city === locationCity)
    : value.provinces.includes(locationProvince);

  function addDestination() {
    if (!locationProvince || alreadyAdded) return;
    if (locationCity) {
      setValue({ ...value,provinces:value.provinces.filter(province => province !== locationProvince),
        cities:[...cities,{ province:locationProvince,city:locationCity }] });
    } else {
      setValue({ ...value,provinces:[...value.provinces,locationProvince],cities:cities.filter(({ province }) => province !== locationProvince) });
    }
    setLocationProvince("");
    setLocationCity("");
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setRemoving(false); setFeedback({});
    start(async () => {
      try {
        const result = await putRule(value);
        if (result.error) { setFeedback({ error:result.error }); return; }
        if (!rule) { setValue(blank); setLocationProvince(""); setLocationCity(""); }
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
    <p className="muted">در هر سطح از مقصد، عدد کمتر زودتر بررسی می‌شود. گزینه‌های خالی یعنی بدون محدودیت.</p>
    <details className="variant"><summary>{destinationCount ? `مقصدهای ارسال (${fa(destinationCount)} مقصد)` : "مقصدهای ارسال"}</summary>
      <div className="flow">
        <div className="form-grid">
          <label>استان<select value={locationProvince} onChange={event => { setLocationProvince(event.target.value); setLocationCity(""); }}>
            <option value="">انتخاب استان</option>{provinces.map(province => <option key={province}>{province}</option>)}
          </select></label>
          <label>شهر<select value={locationCity} disabled={!availableCities.length} onChange={event => setLocationCity(event.target.value)}>
            <option value="">{locationProvince ? "همهٔ شهرهای استان" : "ابتدا استان را انتخاب کنید"}</option>
            {availableCities.map(city => <option key={city}>{city}</option>)}
          </select></label>
        </div>
        <button type="button" className="button" disabled={!locationProvince || alreadyAdded} onClick={addDestination}>افزودن مقصد</button>
        {destinationCount > 0 ? <div className="editor-buttons" role="group" aria-label="مقصدهای انتخاب‌شده">
          {value.provinces.map(province => <button key={province} className="button" type="button" aria-label={`حذف استان ${province}`}
            onClick={() => setValue({ ...value,provinces:value.provinces.filter(option => option !== province) })}>
            {province} (همهٔ شهرها) <X size={14} aria-hidden="true"/>
          </button>)}
          {cities.map(({ province,city }) => <button key={`${province}/${city}`} className="button" type="button" aria-label={`حذف شهر ${city} از ${province}`}
            onClick={() => setValue({ ...value,cities:cities.filter(option => option.province !== province || option.city !== city) })}>
            {province}، {city} <X size={14} aria-hidden="true"/>
          </button>)}
        </div> : <p className="muted">بدون مقصد مشخص، این قانون برای همهٔ مقصدها بررسی می‌شود.</p>}
      </div>
    </details>
    <details className="variant"><summary>دسته‌بندی‌ها {value.categories.length > 0 && `(${fa(value.categories.length)})`}</summary>
      {categories.length ? <div className="checks">{categoryOptions(categories).map(item => <label key={item.id} className="check">
        <input type="checkbox" checked={value.categories.includes(item.id)} onChange={() => setValue({ ...value,
          categories:value.categories.includes(item.id) ? value.categories.filter(id => id !== item.id) : [...value.categories,item.id] })}/>{item.label}</label>)}</div>
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
