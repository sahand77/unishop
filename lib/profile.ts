import { db } from "./db";
import type { Customer, Status } from "./checkout";
import type { Quote } from "./shared";

export type SavedAddress = { id: string; recipient: Customer };
export async function addresses(customerId: string) {
  const result = await db().query<SavedAddress>("SELECT id,recipient FROM customer_addresses WHERE customer_id=$1 ORDER BY id", [customerId]);
  return result.rows;
}

export async function customerOrders(customerId: string) {
  const result = await db().query<{ id: string; quote: Quote; status: Status; created: string; tracking_code: string | null }>(
    "SELECT id,quote::jsonb,status,created,tracking_code FROM orders WHERE customer_id=$1 ORDER BY created DESC", [customerId]);
  return result.rows;
}
