"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { digits } from "@/lib/contact";
import { toman } from "@/lib/shared";

export function AmountInput({ value, onChange, required, min = 0, placeholder }: {
  value: number | null; onChange: (value: number | null) => void;
  required?: boolean; min?: number; placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const display = value === null || (cleared && value === 0) ? "" : toman(value);
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.setCustomValidity(display && Number(value) < min ? `مبلغ باید حداقل ${toman(min)} تومان باشد.` : "");
    if (caret.current !== null) {
      let index = 0, count = 0;
      while (index < display.length && count < caret.current) {
        if (/\d/.test(digits(display[index]))) count++;
        index++;
      }
      el.setSelectionRange(index, index);
      caret.current = null;
    }
  });
  return <input ref={input} type="text" inputMode="numeric" dir="ltr" required={required}
    placeholder={placeholder} value={display} onChange={event => {
      const el = event.currentTarget;
      const raw = digits(el.value).replace(/[٬,]/g, "");
      if (!/^\d*$/.test(raw) || Number(raw) > 1000000000) return;
      caret.current = digits(el.value.slice(0, el.selectionStart ?? el.value.length)).replace(/\D/g, "").length;
      setCleared(raw === "");
      onChange(raw === "" ? null : Number(raw));
    }}/>;
}
