"use client";

import { canonicalCity, citiesForProvince } from "@/lib/iran-cities";
import { provinces } from "@/lib/shared";

export function ProvinceCityFields({ province, city, onChange }: {
  province: string; city: string; onChange: (location: { province: string; city: string }) => void;
}) {
  const canonical = canonicalCity(province,city);
  return <>
    <label><span>استان <span aria-hidden="true">*</span></span>
      <select name="province" autoComplete="address-level1" required value={province}
        onChange={event => onChange({ province:event.target.value,city:"" })}>
        <option value="">انتخاب استان</option>
        {provinces.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
    <label><span>شهر <span aria-hidden="true">*</span></span>
      <select name="city" autoComplete="address-level2" required disabled={!province} value={canonical ?? city}
        onChange={event => onChange({ province,city:event.target.value })}>
        <option value="">{province ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}</option>
        {city && !canonical && <option value={city}>{city} (ثبت‌شدهٔ قبلی)</option>}
        {citiesForProvince(province).map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
  </>;
}
