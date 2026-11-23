"use client";
import { validateRecipient } from "./validate-recipient";
import { changeAddress } from "@/app/profile-actions";
import { provinces } from "@/lib/shared";
import type { SavedAddress } from "@/lib/profile";
import { PendingSubmitButton } from "./pending-button";

export function AddressForm({ address }: { address?: SavedAddress }) {
  const r = address?.recipient;
  return <form noValidate onSubmit={validateRecipient} action={changeAddress} className="flow checkout-fields">
    <input type="hidden" name="id" value={address?.id || ""}/>
    <div className="form-grid">
      <label><span>نام گیرنده <span aria-hidden="true">*</span></span><input name="name" required minLength={2} maxLength={100} defaultValue={r?.name}/></label>
      <label><span>موبایل گیرنده <span aria-hidden="true">*</span></span><input name="mobile" required type="tel" dir="ltr" maxLength={11} defaultValue={r?.mobile}/></label>
      <label><span>استان <span aria-hidden="true">*</span></span><select name="province" required defaultValue={r?.province || ""}><option value="">انتخاب استان</option>{provinces.map(p => <option key={p}>{p}</option>)}</select></label>
      <label><span>شهر <span aria-hidden="true">*</span></span><input name="city" required minLength={2} maxLength={100} defaultValue={r?.city}/></label>
      <label><span>کد پستی <span aria-hidden="true">*</span></span><input name="postalCode" required inputMode="numeric" dir="ltr" minLength={10} maxLength={10} defaultValue={r?.postalCode}/></label>
    </div>
    <label><span>نشانی کامل <span aria-hidden="true">*</span></span><textarea name="address" required minLength={8} maxLength={500} defaultValue={r?.address}/></label>
    <PendingSubmitButton className="button primary" name="operation" value="save" pendingLabel="در حال ذخیره…">ذخیرهٔ آدرس</PendingSubmitButton>
    {address && <PendingSubmitButton className="button" name="operation" value="delete" formNoValidate pendingLabel="در حال حذف…">حذف آدرس</PendingSubmitButton>}
  </form>;
}
