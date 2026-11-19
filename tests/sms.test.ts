import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { mobileNumber, sendCode } from "../lib/sms";
import { requestCode, verifyCode } from "../lib/customer-login";
import { db, closeDb } from "../lib/db";
import { migrate } from "../lib/migrations";

const schema = `sms_test_${randomUUID().replaceAll("-", "")}`;
const management = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const delivered = new Map<string, string>();
const originalFetch = globalThis.fetch;
before(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.href;
  process.env.SMS_API_KEY = "test-key";
  globalThis.fetch = async (_url, options) => {
    assert.equal(_url, "https://api.sms.ir/v1/send/verify");
    assert.equal((options?.headers as Record<string, string>)["X-API-KEY"], "test-key");
    assert.equal(JSON.parse(String(options?.body)).templateId, 123456);
    const payload = JSON.parse(String(options?.body));
    delivered.set(payload.mobile, payload.parameters[0].value);
    return Response.json({ status: 1 });
  };
  await management.query(`CREATE SCHEMA ${schema}`);
  await migrate();
});
after(async () => {
  globalThis.fetch = originalFetch;
  await closeDb();
  await management.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await management.end();
});
test("normalization, one-time consumption and concurrent verification", async () => {
  assert.equal(mobileNumber("+۹۸۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.throws(() => mobileNumber("123"));
  const code = await requestCode("09123456789");
  assert.deepEqual(Object.keys(code).sort(), ["id", "mobile"]);
  await assert.rejects(() => requestCode(code.mobile), /صبر/);
  const results = await Promise.all([verifyCode(code.id, delivered.get(code.mobile)!), verifyCode(code.id, delivered.get(code.mobile)!)]);
  assert.equal(results.filter(Boolean).length, 1);
});
test("attempt limit and expiry", async () => {
  const code = await requestCode("09123456780");
  for (let i = 0; i < 5; i++) assert.equal(await verifyCode(code.id, "000000"), null);
  assert.equal(await verifyCode(code.id, delivered.get(code.mobile)!), null);
  const expired = await requestCode("09123456781");
  await db().query("UPDATE login_codes SET expires=0 WHERE id=$1", [expired.id]);
  assert.equal(await verifyCode(expired.id, delivered.get(expired.mobile)!), null);
});
test("missing provider key prevents sending", async () => {
  delete process.env.SMS_API_KEY;
  try {
    await assert.rejects(() => sendCode("09123456782", "123456"), /تنظیم/);
  } finally {
    process.env.SMS_API_KEY = "test-key";
  }
});
test("provider failure leaves challenge unusable and concurrent sends are limited", async () => {
  const mock = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ status: 0, message: "private provider detail" });
  await assert.rejects(() => requestCode("09123456783"), /ارسال کد انجام نشد/);
  const { rows: [row] } = await db().query("SELECT ready FROM login_codes WHERE mobile=$1", ["09123456783"]);
  assert.equal(row.ready, false);
  globalThis.fetch = mock;
  const results = await Promise.allSettled([requestCode("09123456784"), requestCode("09123456784")]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
});
