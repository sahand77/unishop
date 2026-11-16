import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const cookieName = "unishop-admin";
const lifetime = 60 * 60 * 12;
function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(username: string, password: string) {
  if (!username || username.length > 100 || !password || password.length > 128) return false;
  const { rows:[row] } = await db().query<{ id: string; password: string }>(
    "SELECT id,password FROM admins WHERE username=$1",[username]);
  const [salt, stored] = row ? String(row.password).split(":") : ["unishop-invalid", "0".repeat(128)];
  const valid = timingSafeEqual(scryptSync(password,salt,64),Buffer.from(stored,"hex"));
  if (!row || !valid) return false;
  const token = randomBytes(32).toString("hex");
  const jar = await cookies();
  const oldToken = jar.get(cookieName)?.value;
  if (oldToken) await db().query("DELETE FROM sessions WHERE token=$1",[tokenHash(oldToken)]);
  await db().query("DELETE FROM sessions WHERE expires<=$1",[Date.now()]);
  await db().query("INSERT INTO sessions (token,admin_id,expires) VALUES ($1,$2,$3)",
    [tokenHash(token),row.id,Date.now()+lifetime*1000]);
  jar.set(cookieName,token,{ httpOnly: true, sameSite: "strict", secure: process.env.APP_URL?.startsWith("https:") ?? false,
    path: "/", maxAge: lifetime });
  return true;
}

export async function currentAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const { rows:[row] } = await db().query<{ username: string }>(
    `SELECT admins.username FROM sessions JOIN admins ON admins.id=sessions.admin_id
    WHERE token=$1 AND expires>$2`,[tokenHash(token),Date.now()]);
  return row ? String(row.username) : null;
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db().query("DELETE FROM sessions WHERE token=$1",[tokenHash(token)]);
  jar.delete(cookieName);
}