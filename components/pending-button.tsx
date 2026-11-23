"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";

type ButtonProps = ComponentPropsWithoutRef<"button"> & { pendingLabel: string };

export function PendingButton({ busy, pendingLabel, children, disabled, ...props }: ButtonProps & { busy: boolean }) {
  return <button {...props} disabled={disabled || busy} aria-busy={busy || undefined}>
    <span className="pending-button-content">
      <span className="pending-button-idle" aria-hidden={busy || undefined}>{children}</span>
      <span className="pending-button-wait" aria-hidden={!busy}>
        <span className="button-spinner" aria-hidden="true"/>{pendingLabel}
      </span>
    </span>
  </button>;
}

export function PendingSubmitButton({ disabled, name, value, ...props }: ButtonProps) {
  const { pending, data } = useFormStatus();
  const busy = pending && (!name || data?.get(name) === String(value));
  return <PendingButton {...props} type="submit" name={name} value={value} disabled={disabled || pending} busy={busy}/>;
}
