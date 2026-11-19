"use client";

import { useActionState } from "react";
import { customerPayment } from "@/app/actions";

export function CustomerPayment({ id, token = null }: { id: string; token?: string | null }) {
  const [message, action, pending] = useActionState(customerPayment.bind(null, id, token), "");
  return <form action={action} className="flow">
    <div><button className="button" name="action" value="check" disabled={pending}>استعلام مجدد</button>{" "}
      <button className="button primary" name="action" value="pay" disabled={pending}>پرداخت مجدد</button></div>
    <span role="status">{pending ? "در حال بررسی پرداخت…" : message}</span>
  </form>;
}
