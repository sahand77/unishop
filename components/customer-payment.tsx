"use client";

import { useActionState } from "react";
import { customerPayment } from "@/app/actions";
import { PendingSubmitButton } from "./pending-button";

export function CustomerPayment({ id, token = null }: { id: string; token?: string | null }) {
  const [message, action, pending] = useActionState(customerPayment.bind(null, id, token), "");
  return <form action={action} className="flow">
    <div className="editor-buttons">
      <PendingSubmitButton className="button" name="action" value="check" pendingLabel="در حال استعلام…">استعلام مجدد</PendingSubmitButton>
      <PendingSubmitButton className="button primary" name="action" value="pay" pendingLabel="در حال اتصال به درگاه…">پرداخت مجدد</PendingSubmitButton>
    </div>
    <span role="status">{pending ? "" : message}</span>
  </form>;
}
