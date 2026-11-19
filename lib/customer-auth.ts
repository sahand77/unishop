import { cookies } from "next/headers";
import { db } from "./db";
import { sessionHash, customerLifetime } from "./customer-login";

const cookieName = "unishop-customer";
export async function currentCustomer() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const { rows: [customer] } = await db().query<{ id: string; mobile: string }>(
    `SELECT customers.id, mobile FROM customers JOIN customer_sessions ON customers.id=customer_sessions.customer_id
    WHERE token=$1 AND expires>$2`, [sessionHash(token), Date.now()]);
  return customer || null;
}
export async function logoutCustomer() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db().query("DELETE FROM customer_sessions WHERE token=$1", [sessionHash(token)]);
  jar.delete(cookieName);
}
export async function setCustomerSession(token: string) {
  await logoutCustomer();
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.APP_URL?.startsWith("https:") ?? false, path: "/", maxAge: customerLifetime });
}
