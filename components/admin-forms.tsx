"use client";
import { AmountInput } from "./amount-input";
import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { previewBasalam, putCategory, putIntegration, putProduct, putStoreEnamad, putStoreFooter, putStoreName, signIn } from "@/app/actions";
import { categoryOptions } from "@/lib/category-tree";
import { digits } from "@/lib/contact";
import { enamadCodeLimit } from "@/lib/enamad";
import { discountPercent, effectivePrice } from "@/lib/product-pricing";
import type { CredentialSource, Integration } from "@/lib/integration-settings";
import { fa, money, selectionKey, type Attribute, type Category, type Offer, type Product } from "@/lib/shared";
import type { ProductMedia } from "@/lib/product-media";
import type { StoreFooterSettings } from "@/lib/store-settings";
import { MediaEditor, MediaPreviewDialog, uploadMedia, type ShowMediaPreview } from "./media-editor";
import { PendingButton, PendingSubmitButton } from "./pending-button";
import { ProductImage } from "./store-interactions";

export function LoginForm() {
  const [error,action] = useActionState(signIn,"");
  return <form action={action} className="flow">
    <label>نام کاربری<input name="username" autoComplete="username" required dir="ltr"/></label>
    <label>رمز عبور<input name="password" type="password" autoComplete="current-password" required dir="ltr"/></label>
    {error && <p className="notice error" role="alert">{error}</p>}
    <PendingSubmitButton className="button primary" pendingLabel="در حال ورود…">ورود به پنل</PendingSubmitButton>
  </form>;
}

export function StoreNameForm({ name }: { name: string }) {
  const [feedback, action] = useActionState(putStoreName, { text: "" });
  return <form action={action} className="flow">
    <label>نام فروشگاه<input key={name} name="name" dir="auto" required maxLength={60} defaultValue={name}/></label>
    <PendingSubmitButton className="button primary" pendingLabel="در حال ذخیره…">ذخیرهٔ تغییرات</PendingSubmitButton>
    {feedback.text && <p className={feedback.error ? "notice error" : "notice"}
      role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
  </form>;
}

const credentialStatus: Record<CredentialSource, string> = {
  panel: "از پنل تنظیم شده است.",
  environment: "از تنظیمات محیط اجرا خوانده می‌شود.",
  missing: "هنوز تنظیم نشده است.",
};

export function IntegrationForm({ integration, source }: { integration: Integration; source: CredentialSource }) {
  const [feedback, action, pending] = useActionState(putIntegration.bind(null, integration), { text: "" });
  const payment = integration === "zarinpal";
  return <form action={action} className="flow">
    <p>وضعیت فعلی — {credentialStatus[source]}</p>
    <label>{payment ? "شناسهٔ پذیرنده (Merchant ID)" : "کلید API پیامک"}
      <input name="credential" type="password" autoComplete="new-password" spellCheck={false} dir="ltr"
        required maxLength={payment ? 36 : 512} disabled={pending}/>
    </label>
    <PendingSubmitButton className="button primary" pendingLabel="در حال ذخیره…">
      {payment ? "ذخیرهٔ شناسهٔ پذیرنده" : "ذخیرهٔ کلید پیامک"}
    </PendingSubmitButton>
    {feedback.text && <p className={feedback.error ? "notice error" : "notice"}
      role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
  </form>;
}

export function StoreFooterForm({ settings }: { settings: StoreFooterSettings }) {
  const [feedback, action, pending] = useActionState(putStoreFooter, { text: "" });
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [links, setLinks] = useState(() => settings.socialLinks.map((link, id) => ({ ...link, id })));
  const nextId = useRef(links.length);
  const [uploads, setUploads] = useState(0);

  function updateLink(id: number, patch: Partial<StoreFooterSettings["socialLinks"][number]>) {
    setLinks(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  return <form action={action} className="flow">
    <fieldset className="flow" disabled={pending}>
      <label>آدرس فروشگاه<textarea name="address" rows={3} maxLength={500} dir="auto" value={address}
        onChange={event => setAddress(event.target.value)}/></label>
      <label>شمارهٔ تماس<input name="phone" type="tel" maxLength={40} dir="ltr" value={phone}
        onChange={event => setPhone(event.target.value)}/></label>
      <h3>شبکه‌های اجتماعی</h3>
      {links.map((link, index) => <fieldset className="flow footer-social-editor" key={link.id}>
        <legend>شبکهٔ اجتماعی {fa(index + 1)}</legend>
        <div className="form-grid">
          <label>نام شبکه<input name="socialName" required maxLength={60} dir="auto" value={link.name}
            onChange={event => updateLink(link.id, { name: event.target.value })}/></label>
          <label>لینک صفحه<input name="socialUrl" type="url" required maxLength={2048} dir="ltr" value={link.url}
            onChange={event => updateLink(link.id, { url: event.target.value })}/></label>
        </div>
        <input type="hidden" name="socialLogo" value={link.logo}/>
        <ImageField label="لوگوی شبکه" image={link.logo} onChange={logo => updateLink(link.id, { logo })}
          onBusy={busy => setUploads(count => count + (busy ? 1 : -1))}/>
        <button type="button" className="button danger" disabled={uploads > 0}
          onClick={() => setLinks(items => items.filter(item => item.id !== link.id))}><Trash2 size={17}/> حذف شبکه</button>
      </fieldset>)}
      <button type="button" className="button" disabled={links.length >= 12} onClick={() => {
        const id = nextId.current++;
        setLinks(items => [...items, { id, name: "", url: "", logo: "" }]);
      }}><Plus size={17}/> افزودن شبکهٔ اجتماعی</button>
    </fieldset>
    <PendingSubmitButton className="button primary" pendingLabel="در حال ذخیره…" disabled={uploads > 0}>ذخیرهٔ فوتر</PendingSubmitButton>
    {feedback.text && <p className={feedback.error ? "notice error" : "notice"}
      role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
  </form>;
}

export function StoreEnamadForm({ embed }: { embed: string }) {
  const [feedback, action, pending] = useActionState(putStoreEnamad, { text: "" });
  const [code, setCode] = useState(embed);
  return <form action={action} className="flow">
    <label>کد اینماد<textarea name="enamad" rows={5} maxLength={enamadCodeLimit} dir="ltr"
      spellCheck={false} aria-describedby="enamad-help" value={code} disabled={pending}
      onChange={event => setCode(event.target.value)}/></label>
    <p id="enamad-help">کد HTML دریافتی از اینماد را وارد کنید. برای حذف نماد از فوتر، فیلد را خالی و ذخیره کنید.</p>
    <PendingSubmitButton className="button primary" pendingLabel="در حال ذخیره…">ذخیرهٔ اینماد</PendingSubmitButton>
    {feedback.text && <p className={feedback.error ? "notice error" : "notice"}
      role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
  </form>;
}

export function CategoryForm({ category, parents, defaultParent = "" }: {
  category?: Category; parents: ReturnType<typeof categoryOptions>; defaultParent?: string;
}) {
  const [name,setName] = useState(category?.name ?? "");
  const [parent,setParent] = useState(category ? category.parentId ?? "" : defaultParent);
  const [feedback,action,pending] = useActionState(async (previous: { text: string; error?: boolean }, form: FormData) => {
    const result = await putCategory(previous,form);
    if (!category && !result.error) setName("");
    return result;
  }, { text:"" });
  return <form action={action} className="flow">
    <input type="hidden" name="id" value={category?.id || ""}/>
    <label>نام دسته<input name="name" required maxLength={80} value={name} disabled={pending} onChange={event => setName(event.target.value)}/></label>
    <label>دستهٔ والد<select name="parentId" value={parent} disabled={pending} onChange={event => setParent(event.target.value)}>
      <option value="">بدون والد (دستهٔ اصلی)</option>
      {parents.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <PendingSubmitButton className={`button ${category ? "" : "primary"}`} pendingLabel="در حال ذخیره…">
      {category ? "ذخیرهٔ تغییرات" : "افزودن دسته"}
    </PendingSubmitButton>
    {feedback.text && <p className={`notice${feedback.error ? " error" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
  </form>;
}

function ImageField({ image,onChange,onBusy,label,onPreview }: {
  image: string; onChange: (url: string) => void; onBusy: (busy: boolean) => void; label: string;
  onPreview?: ShowMediaPreview;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError(""); setBusy(true); onBusy(true);
    try {
      const result = await uploadMedia(file);
      if (result.kind !== "image") throw new Error("برای این فیلد یک عکس انتخاب کنید.");
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
      {image && onPreview ? <button type="button" className="media-preview-trigger" aria-label={`پیش‌نمایش ${label}`}
        aria-haspopup="dialog" onClick={() => onPreview({kind:"image",url:image},label)}>
        <ProductImage className="upload-preview" src={image} title=""/>
      </button> : <ProductImage className="upload-preview" src={image} title={label}/>}
      <PendingButton type="button" className="button" busy={busy} pendingLabel="در حال بارگذاری…" onClick={() => input.current?.click()}>
        <ImagePlus size={17}/> بارگذاری تصویر
      </PendingButton>
      {image && <button type="button" className="icon-link danger" aria-label="حذف تصویر" disabled={busy} onClick={() => onChange("")}><Trash2 size={18}/></button>}
    </div>
    <input type="file" ref={input} accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void upload(event.target.files?.[0])}/>
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}

const empty: Offer = { id:"",options:{},price:0,salePrice:null,stock:0,weight:0,sku:"",image:"",active:false,reserved:0 };
function newOffer(options: Record<string,string>): Offer {
  const id = crypto.randomUUID();
  return { ...empty,id,options,sku:`US-${id.slice(0,8)}` };
}

function OfferFields({ item,update,media,defaultMedia,onPreview }: {
  item: Offer; update: (patch: Partial<Offer>) => void; media?: ProductMedia[];
  defaultMedia?: ProductMedia; onPreview?: ShowMediaPreview;
}) {
  const [percentText,setPercentText] = useState<string | null>(null);
  const percent = discountPercent(item);
  const fields = [
    ["stock","موجودی کل",item.reserved], ["weight","وزن به گرم",0],
  ] as const;
  return <div className="flow">
    <div className="form-grid offer-pricing">
      <label>قیمت اصلی به تومان<AmountInput required min={item.active ? 1 : 0} value={item.price}
        onChange={price => { setPercentText(null); update({ price:price ?? 0 }); }}/></label>
      <label>قیمت با تخفیف به تومان<AmountInput min={1} max={item.price - 1} value={item.salePrice} placeholder="اختیاری"
        onChange={salePrice => { setPercentText(null); update({ salePrice }); }}/></label>
      <label>درصد تخفیف<input type="text" inputMode="decimal" dir="ltr" disabled={item.price < 2}
        value={percentText ?? (percent === null ? "" : Number(percent.toFixed(8)))}
        onChange={event => {
          const value = digits(event.target.value).replace(/[٫,]/g,".");
          if (!/^\d{0,3}(?:\.\d{0,8})?$/.test(value)) return;
          setPercentText(value);
          const entered = Number(value);
          update({ salePrice:entered > 0 ? Math.max(0,Math.round(item.price * (1 - entered / 100))) : null });
        }}
        onBlur={() => {
          if (percent !== null || item.salePrice === null) setPercentText(null);
        }}/></label>
    </div>
    <div className="form-grid">
      {fields.map(([key,label,min]) => <label key={key}>{label}
        <input type="number" required min={min} max={1000000000} value={item[key]} onChange={(event) => update({ [key]:Number(event.target.value) })}/>
        {key === "stock" && item.reserved > 0 && <small>{fa(item.reserved)} عدد رزرو شده</small>}
      </label>)}
      <label>کد کالا<input required maxLength={80} dir="ltr" value={item.sku} onChange={(event) => update({ sku:event.target.value })}/></label>
    </div>
    {media && onPreview && <><label className="check"><input type="checkbox" checked={item.active} onChange={(event) => update({ active:event.target.checked })}/> فعال و قابل نمایش</label>
      <fieldset className="option-field"><legend>عکس یا ویدئوی ترکیب</legend>
        <div className="options variant-photos">
          <button type="button" aria-pressed={!item.image} aria-haspopup={defaultMedia ? "dialog" : undefined}
            onClick={() => {
              if (defaultMedia) onPreview(defaultMedia,"پیش‌فرض کالا",() => update({image:""}));
              else update({image:""});
            }}>پیش‌فرض کالا</button>
          {(item.image && !media.some(entry => entry.url === item.image) ? [...media,{
            kind:/\.(mp4|webm)(?:[?#]|$)/i.test(item.image) ? "video" as const : "image" as const, url:item.image,
          }] : media).map((entry,index) => {
            const label = `${entry.kind === "video" ? "ویدئو" : "عکس"} ${fa(index + 1)}`;
            return <button key={entry.url} type="button" aria-pressed={item.image === entry.url} aria-haspopup="dialog"
              aria-label={`پیش‌نمایش ${label}`} onClick={() => onPreview(entry,label,() => update({image:entry.url}))}>
              {entry.kind === "video" ? <span>▶ {label}</span> : <img src={entry.url} loading="lazy" alt=""/>}
            </button>;
          })}
        </div>
      </fieldset></>}
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
  const [submitting,setSubmitting] = useState<"draft" | "published">("draft");
  const [link,setLink] = useState("");
  const [importing,setImporting] = useState(false);
  const [importMessage,setImportMessage] = useState("");
  const [preview,setPreview] = useState<{ media: ProductMedia; label: string; onSelect?: () => void } | null>(null);
  const showPreview: ShowMediaPreview = (media,label,onSelect) => setPreview({ media,label,onSelect });
  const cover: ProductMedia | undefined = image ? {kind:"image",url:image} : undefined;
  const variantMedia = cover && !gallery.some(entry => entry.url === cover.url) ? [cover,...gallery] : gallery;
  const defaultMedia = gallery[0]?.kind === "video" ? gallery[0] : cover ?? gallery[0];
  async function importProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || busy || importing) return;
    setImporting(true);
    setImportMessage("");
    changeBusy(true);
    try {
      const result = await previewBasalam(link.trim());
      if (!result.draft) { setImportMessage(result.error); return; }
      const draft = result.draft;
      setTitle(draft.title); setDescription(draft.description);
      setImage(draft.image); setGallery(draft.gallery);
      setCategory(categories.find(item => item.name === draft.category)?.id ?? "");
      setSimple(draft.simple); setVariants(draft.variants); setAttributes(draft.attributes);
      setKind(draft.variants.length && draft.attributes.length ? "variable" : "simple");
      setAttributeName(""); setSelection({}); setVariantError(""); setFeedback({});
      setImportMessage("اطلاعات آمادهٔ ویرایش است.");
    } catch {
      setImportMessage("ارتباط با فروشگاه برقرار نشد.");
    } finally {
      setImporting(false); changeBusy(false);
    }
  }
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
    if (pending || busy) return;
    const clicked = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = clicked?.value === "published" ? "published" : "draft";
    setSubmitting(status);
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

  return <div className="flow">
    {!id && <form className="panel flow" onSubmit={importProduct}>
      <label>لینک کالای باسلام<input type="url" required dir="ltr" value={link} onChange={event => setLink(event.target.value)} disabled={pending || busy > 0}/></label>
      <PendingButton type="submit" className="button" busy={importing} pendingLabel="در حال دریافت از باسلام…"
        disabled={pending || busy > 0}>پر کردن فرم از باسلام</PendingButton>
      {importMessage && <p role="status">{importMessage}</p>}
    </form>}
    <form onSubmit={submit} className="flow editor">
    <fieldset className="panel flow" disabled={pending || busy > 0}>
      <h2>اطلاعات کالا</h2>
      <label>عنوان کالا<input required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)}/></label>
      <label>توضیحات<textarea rows={4} maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)}/></label>
      <div className="form-grid"><label>دسته‌بندی<select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">بدون دسته</option>{categoryOptions(categories).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>نوع کالا<select value={kind} onChange={(event) => setKind(event.target.value as Product["kind"])}>
          <option value="simple">کالای ساده</option><option value="variable">کالای متغیر</option></select></label>
      </div>
      <ImageField label="عکس کارت کالا" image={image} onChange={setImage} onBusy={changeBusy} onPreview={showPreview}/>
    </fieldset>
    <fieldset className="panel" disabled={pending || busy > 0}>
      <MediaEditor items={gallery} onChange={next => {
        const removed = gallery.filter(old => !next.some(item => item.url === old.url)).map(item => item.url);
        if (removed.length) setVariants(before => before.map(item =>
          item.image !== image && removed.includes(item.image) ? {...item,image:""} : item));
        setGallery(next);
      }} onBusy={changeBusy} onPreview={showPreview}/>
    </fieldset>
    {kind === "simple" ? <fieldset className="panel flow" disabled={pending || importing}>
      <h2>قیمت و موجودی</h2><OfferFields key={simple.id} item={{ ...simple,active:false }} update={(patch) => setSimple((before) => ({ ...before,...patch }))}/>
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
        {variants.map((variant) => <details className="variant flow" key={variant.id} data-unavailable={!variant.active || variant.stock <= variant.reserved}>
          <summary>
            {attributes.map(a => `${a.name}: ${a.values.find(v => v.id === variant.options[a.id])?.name || "—"}`).join(" / ")}
            <span className="muted">{variant.active ? "فعال" : "غیرفعال"}</span>
            <span className="variant-facts">
              <span>قیمت <b>{money(effectivePrice(variant))}</b></span>
              <span>موجودی کل <b>{fa(variant.stock)}</b></span>
              {variant.image && (gallery.some(entry => entry.url === variant.image && entry.kind === "video") ? <span>▶ ویدئوی ترکیب</span> : <img src={variant.image} alt="عکس ترکیب" loading="lazy"/>)}
            </span>
          </summary>
          <OfferFields item={variant} media={variantMedia} defaultMedia={defaultMedia} onPreview={showPreview} update={(patch) =>
            setVariants((before) => before.map((item) => item.id === variant.id ? { ...item,...patch } : item))}/>
          <button type="button" className="button danger" onClick={() => setVariants((before) => before.filter((item) => item.id !== variant.id))}>
            <Trash2 size={16}/> حذف ترکیب</button>
        </details>)}
      </fieldset>
    </>}
    {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
    {feedback.success && <p className="notice" role="status">{feedback.success}</p>}
    <div className="editor-buttons">
      <PendingButton type="submit" className="button" value="draft" disabled={pending || busy > 0}
        busy={pending && submitting === "draft"} pendingLabel="در حال ذخیره…">ذخیرهٔ پیش‌نویس</PendingButton>
      <PendingButton type="submit" className="button primary" value="published" disabled={pending || busy > 0}
        busy={pending && submitting === "published"} pendingLabel="در حال انتشار…"><Save size={17}/> انتشار کالا</PendingButton>
    </div>
  </form>
  {preview && <MediaPreviewDialog {...preview} onClose={() => setPreview(null)}/>}
  </div>;
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
