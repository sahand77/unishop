"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { generateDiscountCode, putDiscount } from "@/app/actions";
import type { Discount, DiscountDraft } from "@/lib/discounts";
import { AmountInput } from "./amount-input";
import { PendingButton } from "./pending-button";

const blank: DiscountDraft = { code: "", kind: "percent", value: null, active: true, minSubtotal: null, maxDiscount: null };

export function DiscountForm({ discount }: { discount?: Discount }) {
  const [fields, setFields] = useState<DiscountDraft>(discount ?? blank);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const [generating, startGenerating] = useTransition();

  function generate() {
    setFeedback({});
    startGenerating(async () => {
      try {
        const result = await generateDiscountCode();
        if ("error" in result) { setFeedback({ error: result.error }); return; }
        setFields(current => ({ ...current, code: result.code }));
      } catch {
        setFeedback({ error: "ارتباط با فروشگاه برقرار نشد. دوباره تلاش کنید." });
      }
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || generating) return;
    setFeedback({});
    start(async () => {
      try {
        const result = await putDiscount(discount?.code ?? null, fields);
        if (result.error) { setFeedback({ error: result.error }); return; }
        if (!discount) setFields(blank);
        setFeedback({ success: "کد تخفیف ذخیره شد." });
      } catch {
        setFeedback({ error: "ارتباط با فروشگاه برقرار نشد. دوباره تلاش کنید." });
      }
    });
  }

  return <form className="flow" onSubmit={submit}>
    <fieldset className="flow" disabled={pending || generating}>
      {!discount && <div className="discount-code-field">
        <label>کد تخفیف<input dir="ltr" required maxLength={32} autoComplete="off" spellCheck={false}
          value={fields.code} onChange={event => setFields({ ...fields, code: event.target.value })}/></label>
        <PendingButton type="button" className="button" busy={generating} pendingLabel="در حال ساخت کد…" onClick={generate}>
          ساخت کد ۸ رقمی
        </PendingButton>
      </div>}
      <div className="form-grid">
        <label>نوع تخفیف<select value={fields.kind} onChange={event => {
          setFields({ ...fields, kind: event.target.value === "fixed" ? "fixed" : "percent", value: null, maxDiscount: null });
          setFeedback({});
        }}><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select></label>
        {fields.kind === "fixed"
          ? <label>مبلغ تخفیف به تومان<AmountInput required min={1} value={fields.value}
              onChange={value => setFields({ ...fields, value })}/></label>
          : <label>درصد تخفیف<input type="number" dir="ltr" required min={1} max={100} value={fields.value ?? ""}
              onChange={event => setFields({ ...fields, value: event.target.value ? Number(event.target.value) : null })}/></label>}
        <label>حداقل جمع کالاهای سبد به تومان<AmountInput min={1} placeholder="بدون حداقل" value={fields.minSubtotal}
          onChange={minSubtotal => setFields({ ...fields, minSubtotal })}/></label>
        {fields.kind === "percent" && <label>سقف تخفیف به تومان<AmountInput min={1} placeholder="بدون سقف" value={fields.maxDiscount}
          onChange={maxDiscount => setFields({ ...fields, maxDiscount })}/></label>}
      </div>
      <label className="check"><input type="checkbox" checked={fields.active}
        onChange={event => setFields({ ...fields, active: event.target.checked })}/> فعال</label>
    </fieldset>
    {feedback.error && <p className="notice error" role="alert">{feedback.error}</p>}
    {feedback.success && <p role="status">{feedback.success}</p>}
    <PendingButton type="submit" className="button primary" disabled={generating} busy={pending} pendingLabel="در حال ذخیره…">
      {discount ? "ذخیرهٔ تغییرات" : "افزودن کد تخفیف"}
    </PendingButton>
  </form>;
}

export function CopyDiscountCode({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const Icon = status === "copied" ? Check : Copy;

  async function copy() {
    setStatus("idle");
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return <div className="discount-copy">
    <button type="button" className="button" aria-label={`کپی کد تخفیف ${code}`} onClick={copy}>
      <Icon size={16} aria-hidden="true"/><span aria-live="polite">{status === "copied" ? "کپی شد" : "کپی"}</span>
    </button>
    {status === "error" && <p role="alert">کپی انجام نشد. کد را دستی کپی کنید.</p>}
  </div>;
}
