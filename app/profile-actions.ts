"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { customerSchema } from "@/lib/checkout";
import { currentCustomer } from "@/lib/customer-auth";
import { db } from "@/lib/db";
import { digits } from "@/lib/sms";

export async function changeAddress(form: FormData) {
  const customer = await currentCustomer();
  if (!customer) redirect("/login");
  const id = String(form.get("id") || "");
  if (form.get("operation") === "delete") {
    await db().query("DELETE FROM customer_addresses WHERE id=$1 AND customer_id=$2", [id, customer.id]);
  } else {
    const recipient = customerSchema.safeParse({ ...Object.fromEntries(form), mobile: digits(String(form.get("mobile"))), postalCode: digits(String(form.get("postalCode"))) });
    if (!recipient.success) redirect(`/account?error=${encodeURIComponent(recipient.error.issues[0].message)}#addresses`);
    if (id) {
      await db().query("UPDATE customer_addresses SET recipient=$1 WHERE id=$2 AND customer_id=$3", [recipient.data, id, customer.id]);
    } else {
      await db().query("INSERT INTO customer_addresses (id,customer_id,recipient) VALUES ($1,$2,$3)", [randomUUID(), customer.id, recipient.data]);
    }
  }
  revalidatePath("/account");
  revalidatePath("/checkout");
  redirect("/account#addresses");
}

export async function updateTracking(id: string, form: FormData) {
  await requireAdmin();
  const code = String(form.get("tracking") || "").trim();
  if (code.length > 80) throw new Error("کد رهگیری بیش از حد طولانی است.");
  await db().query("UPDATE orders SET tracking_code=$1 WHERE id=$2 AND status='paid'", [code || null, id]);
  revalidatePath("/account");
  revalidatePath(`/admin/orders/${id}`);
}
