"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { putCategory, putProduct, signIn } from "@/app/actions";
import { fa, selectionKey, type Attribute, type Category, type Offer, type Product } from "@/lib/shared";
import type { ProductMedia } from "@/lib/product-media";
import { MediaEditor, uploadMedia } from "./media-editor";
import { ProductImage } from "./store-interactions";

export function LoginForm() {
  const [error,action,pending] = useActionState(signIn,"");
  return <form action={action} className="flow">
    <label>نام کاربری<input name="username" autoComplete="username" required dir="ltr"/></label>
    <label>رمز عبور<input name="password" type="password" autoComplete="current-password" required dir="ltr"/></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button primary" disabled={pending}>ورود به پنل</button>
  </form>;
}

export function CategoryForm({ category }: { category?: Category }) {
  const [feedback,action,pending] = useActionState(putCategory,"");
  return <form action={action} className="flow">
    <input type="hidden" name="id" value={category?.id || ""}/>
    <label>{category ? "نام دسته" : "نام دستهٔ جدید"}<input key={category?.name} name="name" required maxLength={80} defaultValue={category?.name}/></label>
    <button className={`button ${category ? "" : "primary"}`} disabled={pending}>{category ? "ذخیرهٔ تغییرات" : "افزودن دسته"}</button>
    {feedback && <p className="notice" role="status">{feedback}</p>}
  </form>;
}

function ImageField({ image,onChange,onBusy,label }: {
  image: string; onChange: (url: string) => void; onBusy: (busy: boolean) => void; label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError(""); setBusy(true); onBusy(true);
    try {
      const result = await uploadMedia(file);
      if (result.kind !== "image") throw new Error("برای تصویر اصلی یا ترکیب، فایل عکس انتخاب کنید.");
      onChange(result.url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "بارگذاری تصویر انجام نشد.");
    } finally {
      setBusy(false); onBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return <div className="flow">
    <span className="field-label">{label}</span><div className="upload-inner">
      <ProductImage className="upload-preview" src={image} title={label}/>
      <button type="button" className="button" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={17}/>{busy ? "در حال بارگذاری" : "بارگذاری تصویر"}</button>
      {image && <button type="button" className="icon-link danger" aria-label="حذف تصویر" disabled={busy} onClick={() => onChange("")}><Trash2 size={18}/></button>}
    </div>
    <input type="file" ref={input} accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void upload(event.target.files?.[0])}/>
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}

const empty: Offer = { id:"",options:{},price:0,stock:0,weight:0,sku:"",image:"",active:false,reserved:0 };
function newOffer(options: Record<string,string>): Offer {
  const id = crypto.randomUUID();
  return { ...empty,id,options,sku:`US-${id.slice(0,8)}` };
}

function OfferFields({ item,update,variant,onBusy }: {
  item: Offer; update: (patch: Partial<Offer>) => void; variant: boolean; onBusy: (busy: boolean) => void;
}) {
  const fields = [
    ["price","قیمت به تومان",item.active ? 1 : 0], ["stock","موجودی کل",item.reserved], ["weight","وزن به گرم",0],
  ] as const;
  return <div className="flow">
    <div className="form-grid">
      {fields.map(([key,label,min]) => <label key={key}>{label}
        <input type="number" required min={min} max={1000000000} value={item[key]} onChange={(event) => update({ [key]:Number(event.target.value) })}/>
        {key === "stock" && item.reserved > 0 && <small>{fa(item.reserved)} عدد رزرو شده</small>}
      </label>)}
      <label>کد کالا<input required maxLength={80} dir="ltr" value={item.sku} onChange={(event) => update({ sku:event.target.value })}/></label>
    </div>
    {variant && <><label className="check"><input type="checkbox" checked={item.active} onChange={(event) => update({ active:event.target.checked })}/> فعال و قابل نمایش</label>
      <ImageField image={item.image} label="تصویر ترکیب" onBusy={onBusy} onChange={(image) => update({image})}/></>}
  </div>;
}

export function ProductForm({ initial,categories }: { initial?: Product; categories: Category[] }) {
  const router = useRouter();
  const [id,setId] = useState(initial?.id);
  const [expectedStock,setExpectedStock] = useState(() => Object.fromEntries(initial?.offers.map((item) => [item.id,item.stock]) ?? []));
  const [title,setTitle] = useState(initial?.title || "");
  const [description,setDescription] = useState(initial?.description || "");
  const [category,setCategory] = useState(initial?.categoryId || "");
  const [image,setImage] = useState(initial?.image || "");
  const [gallery,setGallery] = useState<ProductMedia[]>(initial?.gallery || []);
  const [kind,setKind] = useState(initial?.kind || "simple");
  const [attributes,setAttributes] = useState<Attribute[]>(initial?.attributes || []);
  const [simple,setSimple] = useState(initial?.kind === "simple" ? initial.offers[0] || empty : empty);
  const [variants,setVariants] = useState<Offer[]>(initial?.kind === "variable" ? initial.offers : []);
  const [selection,setSelection] = useState<Record<string,string>>({});
  const [attributeName,setAttributeName] = useState("");
  const [variantError,setVariantError] = useState("");
  const [feedback,setFeedback] = useState<{ error?: string; success?: string }>({});
  const [busy,setBusy] = useState(0);
  const [pending,start] = useTransition();
  const changeBusy = (value: boolean) => setBusy((count) => count+(value ? 1 : -1));
  const changeAttribute = (id: string, change: (item: Attribute) => Attribute) =>
    setAttributes((before) => before.map((item) => item.id === id ? change(item) : item));

  function addAttribute() {
    const name = attributeName.trim();
    if (!name || attributes.length >= 8) return;
    if (variants.length) { setVariantError("برای افزودن ویژگی تازه ابتدا ترکیب‌ها را حذف کنید."); return; }
    if (attributes.some((attribute) => attribute.name === name)) { setVariantError("این ویژگی قبلاً اضافه شده است."); return; }
    const id = crypto.randomUUID();
    setAttributes((before) => [...before,{ id,name,values:[] }]);
    setAttributeName(""); setVariantError("");
  }
  function generate() {
    setVariantError("");
    const count = attributes.reduce((total,attribute) => total*attribute.values.length,1);
    if (!attributes.length || !count) { setVariantError("برای هر ویژگی دست‌کم یک مقدار تعریف کنید."); return; }
    if (count > 300) { setVariantError("حداکثر ۳۰۰ ترکیب قابل تعریف است. ترکیب‌ها را دستی اضافه کنید."); return; }
    const existing = new Set(variants.map((variant) => selectionKey(variant.options)));
    const combinations = attributes.reduce<Record<string,string>[]>((list,attribute) =>
      list.flatMap((entry) => attribute.values.map((value) => ({ ...entry,[attribute.id]:value.id }))),[{}]);
    setVariants([...variants,...combinations.filter((options) => !existing.has(selectionKey(options))).map(newOffer)]);
  }
  function addManual() {
    if (!attributes.length || !attributes.every((attribute) => attribute.values.some((value) => value.id === selection[attribute.id]))) {
      setVariantError("برای هر ویژگی یک مقدار انتخاب کنید."); return;
    }
    if (variants.some((item) => selectionKey(item.options) === selectionKey(selection))) {
      setVariantError("این ترکیب قبلاً ثبت شده است."); return;
    }
    if (variants.length >= 300) { setVariantError("حداکثر ۳۰۰ ترکیب قابل تعریف است."); return; }
    setVariants([...variants,newOffer({ ...selection })]); setVariantError("");
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const clicked = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = clicked?.value === "published" ? "published" : "draft";
    const offers = kind === "simple" ? [{
      ...simple,id:simple.id || crypto.randomUUID(),
      active:simple.price > 0,
    }] : variants;
    setFeedback({});
    start(async () => {
      try {
        const result = await putProduct({ id,title,description,categoryId:category,image,gallery,kind,status,
          attributes:kind === "simple" ? [] : attributes,offers:offers.map((item) => ({ ...item, expectedStock:expectedStock[item.id] })) });
        if (!result.id) { setFeedback({ error:result.error }); return; }
        setId(result.id); setExpectedStock(Object.fromEntries(offers.map((item) => [item.id,item.stock])));
        if (kind === "simple") {
          setSimple({ ...offers[0],active:false });
          setAttributes([]); setVariants([]); setSelection({});
        } else {
          setSimple(empty);
        }
        setFeedback({ success:status === "published" ? "کالا منتشر شد." : "پیش‌نویس ذخیره شد." });
        if (!id) router.replace(`/admin/products/${result.id}`);
        else router.refresh();
      } catch { setFeedback({ error:"ارتباط با فروشگاه برقرار نشد." }); }
    });
  }

  return <form onSubmit={submit} className="flow editor">
    <fieldset className="panel flow" disabled={pending || busy > 0}>
      <h2>اطلاعات کالا</h2>
      <label>عنوان کالا<input required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)}/></label>
      <label>توضیحات<textarea rows={4} maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)}/></label>
      <div className="form-grid"><label>دسته‌بندی<select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">بدون دسته</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>نوع کالا<select value={kind} onChange={(event) => setKind(event.target.value as Product["kind"])}>
          <option value="simple">کالای ساده</option><option value="variable">کالای متغیر</option></select></label>
      </div>
      <ImageField label="تصویر اصلی کالا" image={image} onChange={setImage} onBusy={changeBusy}/>
    </fieldset>
    <fieldset className="panel" disabled={pending || busy > 0}>
      <MediaEditor items={gallery} onChange={setGallery} onBusy={changeBusy}/>
    </fieldset>
    {kind === "simple" ? <fieldset className="panel flow" disabled={pending}>
      <h2>قیمت و موجودی</h2><OfferFields item={{ ...simple,active:false }} update={(patch) => setSimple((before) => ({ ...before,...patch }))} variant={false} onBusy={changeBusy}/>
    </fieldset> : <>
      <fieldset className="panel flow" disabled={pending || busy > 0}>
        <h2>ویژگی‌ها</h2>
        <div className="editor-inline"><label>نام ویژگی جدید<input placeholder="مثل رنگ" value={attributeName} onChange={(event) => setAttributeName(event.target.value)} maxLength={60}/></label>
          <button type="button" className="button" onClick={addAttribute}><Plus size={17}/> افزودن ویژگی</button></div>
        {attributes.map((attribute) => <AttributeEditor key={attribute.id} attribute={attribute} locked={variants.some((variant) => attribute.id in variant.options)}
          rename={(name) => changeAttribute(attribute.id,(item) => ({ ...item,name }))}
          renameValue={(id,name) => changeAttribute(attribute.id,(item) => ({ ...item,values:item.values.map((value) => value.id === id ? { ...value,name } : value) }))}
          add={(raw) => {
            const name = raw.trim();
            if (!name || attribute.values.length >= 30) return;
            if (attribute.values.some((value) => value.name === name)) { setVariantError("این مقدار قبلاً اضافه شده است."); return; }
            const id = crypto.randomUUID();
            changeAttribute(attribute.id,(item) => ({ ...item,values:[...item.values,{ id,name }] }));
            setVariantError("");
          }} remove={() => { setAttributes(attributes.filter((item) => item.id !== attribute.id)); setSelection({}); }}
          dropValue={(id) => {
            changeAttribute(attribute.id,(item) => ({ ...item,values:item.values.filter((value) => value.id !== id) }));
            setSelection({});
          }}/>)}
      </fieldset>
      <fieldset className="panel flow" disabled={pending || busy > 0}>
        <div className="section-head"><h2>ترکیب‌های کالا</h2><button type="button" className="button" onClick={generate}><Sparkles size={16}/> ساخت همهٔ ترکیب‌ها</button></div>
        {attributes.length > 0 && <div className="form-grid">{attributes.map((attribute) => <label key={attribute.id}>{attribute.name}
          <select value={selection[attribute.id] || ""} onChange={(event) => setSelection({ ...selection,[attribute.id]:event.target.value })}>
            <option value="">انتخاب مقدار</option>{attribute.values.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>)}</div>}
        <button type="button" className="button" onClick={addManual}><Plus size={17}/> افزودن ترکیب دستی</button>
        {variantError && <p className="notice error" role="alert">{variantError}</p>}
        {variants.map((variant) => <details className="variant flow" key={variant.id}>
          <summary>{attributes.map((a) => a.values.find((v) => v.id === variant.options[a.id])?.name || "—").join(" / ")}
            <span className="muted">{variant.active ? "فعال" : "غیرفعال"}</span></summary>
          <OfferFields item={variant} variant onBusy={changeBusy} update={(patch) =>
            setVariants((before) => before.map((item) => item.id === variant.id ? { ...item,...patch } : item))}/>
          <button type="button" className="button danger" onClick={() => setVariants((before) => before.filter((item) => item.id !== variant.id))}>
            <Trash2 size={16}/> حذف ترکیب</button>
        </details>)}
      </fieldset>
    </>}
    {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
    {feedback.success && <p className="notice" role="status">{feedback.success}</p>}
    <div className="editor-buttons"><button type="submit" className="button" value="draft" disabled={pending || busy > 0}>ذخیرهٔ پیش‌نویس</button>
      <button type="submit" className="button primary" value="published" disabled={pending || busy > 0}><Save size={17}/> انتشار کالا</button></div>
  </form>;
}

function AttributeEditor({ attribute,locked,rename,renameValue,add,remove,dropValue }: {
  attribute: Attribute; locked: boolean; rename: (name: string) => void; renameValue: (id: string,name: string) => void;
  add: (value: string) => void; remove: () => void; dropValue: (id: string) => void;
}) {
  const [value,setValue] = useState("");
  return <div className="variant flow">
    <div className="editor-inline"><label>نام ویژگی<input required maxLength={60} value={attribute.name} onChange={(event) => rename(event.target.value)}/></label>
      <button type="button" disabled={locked} className="icon-link danger" aria-label="حذف ویژگی" onClick={remove}><Trash2 size={18}/></button></div>
    <div className="form-grid">{attribute.values.map((item) => <div className="editor-inline" key={item.id}>
      <label>مقدار<input required maxLength={60} value={item.name} onChange={(event) => renameValue(item.id,event.target.value)}/></label>
      <button type="button" disabled={locked} className="icon-link danger" aria-label="حذف مقدار" onClick={() => dropValue(item.id)}><Trash2 size={17}/></button>
    </div>)}</div>
    <div className="editor-inline"><label>مقدار جدید<input maxLength={60} value={value} placeholder="مثل قرمز" onChange={(event) => setValue(event.target.value)}/></label>
      <button type="button" className="button" onClick={() => { add(value); setValue(""); }}><Plus size={17}/> افزودن مقدار</button></div>
  </div>;
}
