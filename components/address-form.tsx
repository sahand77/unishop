"use client";
import { useState } from "react";
import { validateRecipient } from "./validate-recipient";
import { changeAddress } from "@/app/profile-actions";
import type { SavedAddress } from "@/lib/profile";
import { PendingSubmitButton } from "./pending-button";
import { ProvinceCityFields } from "./province-city-fields";

export function AddressForm({ address }: { address?: SavedAddress }) {
  const r = address?.recipient;
  const initialLocation = { province:r?.province ?? "",city:r?.city ?? "" };
  const [location,setLocation] = useState(initialLocation);
  return <form noValidate onSubmit={validateRecipient} onReset={() => setLocation(initialLocation)} action={changeAddress} className="flow checkout-fields">
    <input type="hidden" name="id" value={address?.id || ""}/>
    <div className="form-grid">
      <label><span>نام گیرنده <span aria-hidden="true">*</span></span><input name="name" required minLength={2} maxLength={100} defaultValue={r?.name}/></label>
      <label><span>موبایل گیرنده <span aria-hidden="true">*</span></span><input name="mobile" required type="tel" dir="ltr" maxLength={11} defaultValue={r?.mobile}/></label>
      <ProvinceCityFields {...location} onChange={setLocation}/>
      <label><span>کد پستی <span aria-hidden="true">*</span></span><input name="postalCode" required inputMode="numeric" dir="ltr" minLength={10} maxLength={10} defaultValue={r?.postalCode}/></label>
    </div>
    <label><span>نشانی کامل <span aria-hidden="true">*</span></span><textarea name="address" required minLength={8} maxLength={500} defaultValue={r?.address}/></label>
    <PendingSubmitButton className="button primary" name="operation" value="save" pendingLabel="در حال ذخیره…">ذخیرهٔ آدرس</PendingSubmitButton>
    {address && <PendingSubmitButton className="button" name="operation" value="delete" formNoValidate pendingLabel="در حال حذف…">حذف آدرس</PendingSubmitButton>}
  </form>;
}
