"use client";
import { useActionState } from "react";
import { customerLogin } from "@/app/customer-actions";

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(customerLogin, {});
  return <div className="flow">
    <form action={action} className="flow">
      <input type="hidden" name="step" value="send"/>
      <label className="flow">شماره موبایل<input name="mobile" type="tel" autoComplete="tel" dir="ltr" required maxLength={20} defaultValue={state.mobile} placeholder="09123456789"/></label>
      <button className="button primary" disabled={pending}>{pending ? "در حال پردازش…" : state.id ? "ارسال دوباره / تغییر شماره" : "دریافت کد ورود"}</button>
    </form>
    {state.id && <form action={action} className="flow">
      <p>کد ورود برای <bdi>{state.mobile}</bdi> آماده شد. اعتبار کد دو دقیقه است؛ ارسال دوباره پس از یک دقیقه امکان‌پذیر است.</p>
      <input type="hidden" name="step" value="verify"/><input type="hidden" name="id" value={state.id}/>
      <label className="flow">کد شش‌رقمی<input name="code" autoComplete="one-time-code" inputMode="numeric" dir="ltr" required minLength={6} maxLength={6}/></label>
      <button className="button primary" disabled={pending}>تأیید و ورود</button>
    </form>}
    {state.error && <p role="alert" className="danger">{state.error}</p>}
  </div>;
}
