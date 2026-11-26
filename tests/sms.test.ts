import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { mobileNumber, sendCode, sendTemplate } from "../lib/sms";
import { requestCode, verifyCode } from "../lib/customer-login";
import { db, closeDb } from "../lib/db";
import { advanceFulfillment } from "../lib/fulfillment";
import { credentialSource, saveCredential } from "../lib/integration-settings";
import { migrate } from "../lib/migrations";

const schema = `sms_test_${randomUUID().replaceAll("-", "")}`;
const management = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const delivered = new Map<string, string>();
const notifications: { mobile: string; templateId: number; parameters: { name: string; value: string }[] }[] = [];
const originalFetch = globalThis.fetch;
before(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.href;
  process.env.SMS_API_KEY = "test-key";
  delete process.env.SMS_TEMPLATE_ID;
  delete process.env.SMS_CODE_PARAMETER;
  globalThis.fetch = async (_url, options) => {
    assert.equal(_url, "https://api.sms.ir/v1/send/verify");
    assert.equal((options?.headers as Record<string, string>)["X-API-KEY"], "test-key");
    const payload = JSON.parse(String(options?.body));
    if (payload.templateId === 259263) {
      assert.equal(payload.parameters[0].name, "CODE");
      delivered.set(payload.mobile, payload.parameters[0].value);
    } else {
      notifications.push(payload);
    }
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
  assert.equal(mobileNumber("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.throws(() => mobileNumber("+989123456789"));
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

test("order approval and shipment send each template once", async () => {
  const id = randomUUID();
  const customerId = randomUUID();
  const mobile = "09123456785";
  await db().query("INSERT INTO customers (id,mobile) VALUES ($1,$2)", [customerId, mobile]);
  const { rows: [created] } = await db().query(`
    INSERT INTO orders (id,attempt,secret,customer,quote,amount,mode,status,created,request_started,customer_id)
    VALUES ($1,$1,'secret',$2,'{}',0,'simulator','pending',0,0,$3)
    RETURNING fulfillment_status
  `, [id, JSON.stringify({ mobile: "09123456786" }), customerId]);
  assert.equal(created.fulfillment_status, "awaiting_confirmation");
  assert.equal(await advanceFulfillment(id, { event: "confirm" }), "unchanged");

  await db().query("UPDATE orders SET status='paid' WHERE id=$1", [id]);
  const ship = { event: "ship", trackingCode: "123456789012345678901234" } as const;
  assert.equal(await advanceFulfillment(id, ship), "unchanged");
  const confirmations = await Promise.all([
    advanceFulfillment(id, { event: "confirm" }),
    advanceFulfillment(id, { event: "confirm" }),
  ]);
  assert.deepEqual(confirmations.sort(), ["sent", "unchanged"]);
  const { rows: [confirmed] } = await db().query("SELECT fulfillment_status FROM orders WHERE id=$1", [id]);
  assert.equal(confirmed.fulfillment_status, "awaiting_shipment");

  assert.equal(await advanceFulfillment(id, ship), "sent");
  assert.equal(await advanceFulfillment(id, ship), "unchanged");
  const { rows: [shipped] } = await db().query("SELECT status,fulfillment_status,tracking_code FROM orders WHERE id=$1", [id]);
  assert.deepEqual(shipped, { status: "paid", fulfillment_status: "shipped", tracking_code: ship.trackingCode });
  assert.deepEqual(notifications, [
    { mobile, templateId: 868696, parameters: [{ name: "TOKEN", value: ` شماره سفارش: ${id.slice(0,8)}` }] },
    { mobile, templateId: 841736, parameters: [{ name: "ORDERID", value: ship.trackingCode }] },
  ]);
});

test("the encrypted panel credential overrides the environment for login and order SMS", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "unishop-sms-"));
  const previousDirectory = process.env.UNISHOP_DATA_DIR;
  process.env.UNISHOP_DATA_DIR = directory;
  context.after(async () => {
    if (previousDirectory === undefined) delete process.env.UNISHOP_DATA_DIR;
    else process.env.UNISHOP_DATA_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  assert.equal(await credentialSource("sms"), "environment");
  const key = "panel-test-key";
  await saveCredential("sms", key);
  assert.equal(await credentialSource("sms"), "panel");
  const { rows: [setting] } = await db().query("SELECT value FROM store_settings WHERE key='integration_sms'");
  assert.ok(!setting.value.includes(key));

  const sent: string[] = [];
  context.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    sent.push(new Headers(init.headers).get("X-API-KEY")!);
    return Response.json({ status: 1 });
  });
  await sendCode("09123456787", "123456");
  await sendTemplate("09123456787", 868696, [{ name: "TOKEN", value: "order" }]);
  assert.deepEqual(sent, [key, key]);
});
