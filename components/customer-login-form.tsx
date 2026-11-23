"use client";
import { digits } from "@/lib/contact";
import { useActionState } from "react";
import { customerLogin } from "@/app/customer-actions";
import { PendingSubmitButton } from "./pending-button";

function validateLogin(event: React.FormEvent<HTMLFormElement>) {
      const field = event.currentTarget.querySelector<HTMLInputElement>("input:not([type=hidden])")!;
      const mobile = field.name === "mobile";
      if ((mobile ? /^09\d{9}$/ : /^\d{6}$/).test(digits(field.value))) return;
      event.preventDefault();
      field.setCustomValidity(mobile ? "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود." : "کد ورود باید دقیقاً ۶ رقم باشد.");
      field.reportValidity();
      field.setCustomValidity("");
    }

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(customerLogin, {});
  return <div className="flow">
    <form noValidate onSubmit={validateLogin} action={action} className="flow">
      <input type="hidden" name="step" value="send"/>
      <label className="flow"><span>شماره موبایل <span aria-hidden="true">*</span></span><input name="mobile" type="tel" autoComplete="tel" dir="ltr" required maxLength={20} defaultValue={state.mobile} placeholder="09123456789"/></label>
      <PendingSubmitButton className="button primary" disabled={pending} pendingLabel="در حال ارسال کد…">
        {state.id ? "ارسال دوباره / تغییر شماره" : "دریافت کد ورود"}
      </PendingSubmitButton>
    </form>
    {state.id && <form noValidate onSubmit={validateLogin} action={action} className="flow">
      <p>کد ورود برای <bdi>{state.mobile}</bdi> آماده شد. اعتبار کد دو دقیقه است؛ ارسال دوباره پس از یک دقیقه امکان‌پذیر است.</p>
      <input type="hidden" name="step" value="verify"/><input type="hidden" name="id" value={state.id}/>
      <label className="flow"><span>کد شش‌رقمی <span aria-hidden="true">*</span></span><input name="code" autoComplete="one-time-code" inputMode="numeric" dir="ltr" required minLength={6} maxLength={6}/></label>
      <PendingSubmitButton className="button primary" disabled={pending} pendingLabel="در حال تأیید کد…">تأیید و ورود</PendingSubmitButton>
    </form>}
    {state.error && <p role="alert" className="danger">{state.error}</p>}
  </div>;
}
