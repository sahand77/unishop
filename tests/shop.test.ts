import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { categories, product, saveCategory, saveProduct } from "../lib/catalog";
import { cancelOrder, order, quote, reserveOrder } from "../lib/checkout";
import { Pool } from "pg";
import { addresses, customerOrders } from "../lib/profile";
import { db, closeDb } from "../lib/db";
import { migrate } from "../lib/migrations";
import { initiate, recheck, resumePayment, verify } from "../lib/payment";
import { rules, saveRule } from "../lib/shipping";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL must point to a PostgreSQL database for tests.");
const schema = `unishop_test_${randomUUID().replaceAll("-","")}`;
const management = new Pool({ connectionString:testUrl });
const url = new URL(testUrl);
url.searchParams.set("options",`-c search_path=${schema}`);
process.env.DATABASE_URL = url.href;
process.env.APP_URL = "http://127.0.0.1:3000";
before(async () => {
  await management.query(`CREATE SCHEMA ${schema}`);
  await migrate();
});
after(async () => {
  await closeDb();
  try {
    await management.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  } finally {
    await management.end();
  }
});

const customer = { name:"مشتری نمونه", mobile:"09120000000", province:"تهران" as const,
  city:"تهران", address:"نشانی نمونه برای ارسال", postalCode:"1234567890" };
const baseOffer = { price:100000,weight:150,stock:1,sku:"",image:"",active:true,options:{} };
const baseRule = { id:"",name:"ارسال معمولی",priority:100,fee:20000,provinces:[],categories:[],
  minQuantity:null,maxQuantity:null,minWeight:null,maxWeight:null,minSubtotal:null,maxSubtotal:null };
const baseProduct = { title:"کالای آزمایشی",description:"",image:"",kind:"simple",status:"published",attributes:[] };
async function inventory(stock = 1, categoryId = "") {
  const offer = { ...baseOffer,id:randomUUID(),sku:randomUUID(),stock };
  const id = await saveProduct({ ...baseProduct,categoryId,offers:[offer] });
  return { id,offer,lines:[{ id:offer.id,quantity:1 }] };
}

test("قوانین ارسال هم‌زمان و مرزهای بازه", async () => {
  await saveCategory("","دیجیتال");
  await saveCategory("","پوشاک");
  const groups = await categories();
  const digital = groups.find((item) => item.name === "دیجیتال")!;
  const clothing = groups.find((item) => item.name === "پوشاک")!;
  const a = await inventory(2,digital.id);
  const b = await inventory(2,clothing.id);
  await assert.rejects(() => quote(a.lines,"یزد"),/روش ارسال/);
  await saveRule(baseRule);
  await saveRule({ ...baseRule,name:"ارسال سفارشی",fee:5000,priority:10,provinces:["تهران"],categories:[digital.id],
    minQuantity:2,maxQuantity:2,minWeight:300,maxWeight:300,minSubtotal:200000,maxSubtotal:200000 });
  await saveRule({ ...baseRule,name:"تهران",fee:15000,priority:20,provinces:["تهران"] });
  const lines = [...a.lines,...b.lines];
  const matching = await quote(lines,"تهران");
  assert.equal(matching.shipping,5000);
  assert.equal(matching.total,205000);
  assert.equal((await quote(b.lines,"تهران")).shipping,15000);
  assert.equal((await quote(lines,"یزد")).shipping,20000);
  assert.deepEqual((await rules()).map((item) => item.priority),[10,20,100]);
});

test("کالاهای پیش‌نویس و ترکیب‌های غیرفعال در خرید در دسترس نیستند", async () => {
  const a = await inventory();
  const item = (await product(a.id))!;
  await saveProduct({ ...item,status:"draft" });
  assert.equal(await product(a.id,true),undefined);
  await assert.rejects(() => quote(a.lines,"تهران"),/موجودی/);
  const attributes = [{ id:"size",name:"اندازه",values:[{ id:"s",name:"کوچک" },{ id:"l",name:"بزرگ" }] }];
  const active = { ...baseOffer,id:randomUUID(),sku:randomUUID(),options:{size:"s"} };
  const inactive = { ...baseOffer,id:randomUUID(),sku:randomUUID(),options:{size:"l"},active:false,price:0 };
  const input = { ...baseProduct,kind:"variable",categoryId:"",attributes,offers:[active,inactive] };
  const id = await saveProduct(input);
  await assert.rejects(() => saveProduct({ ...input,id,offers:[active,{ ...inactive,options:{size:"s"} }] }),/یکتا/);
  assert.equal((await product(id))!.offers.length,2);
  await assert.rejects(() => quote([{ id:inactive.id,quantity:1 }],"تهران"),/موجودی/);
});

test("گالری مرتب ذخیره می‌شود و فرم قدیمی آن را پاک نمی‌کند", async () => {
  const entry = await inventory();
  const saved = (await product(entry.id))!;
  assert.deepEqual(saved.gallery,[]);
  const media = [
    { kind:"video",url:"/demo/example.mp4" },
    { kind:"image",url:"/demo/example.jpg" },
  ];
  await saveProduct({ ...saved,gallery:media });
  const updated = (await product(entry.id,true))!;
  assert.deepEqual(updated.gallery,media);
  assert.equal(updated.image,"/demo/example.jpg");
  const { gallery: _, ...legacy } = updated;
  await saveProduct({ ...legacy,title:"عنوان تازه" });
  assert.deepEqual((await product(entry.id))!.gallery,media);
  await assert.rejects(() => saveProduct({ ...legacy,gallery:[{ kind:"image",url:"/demo/example.mp4" }] }));
});

test("تأیید مبلغ جدید، رزرو آخرین واحد، و تأیید تکراری پرداخت", async () => {
  const a = await inventory();
  const shown = await quote(a.lines,"تهران");
  const attempt = randomUUID();
  const input = { lines:a.lines,customer,shown,attempt,mode:"simulator" as const };
  const stale = await reserveOrder({ ...input,shown:{ ...shown,total:shown.total-1 } });
  assert.equal(stale.changed?.total,shown.total);
  assert.equal((await product(a.id))!.offers[0].reserved,0);
  const reserved = await reserveOrder(input);
  assert.ok(reserved.order);
  assert.equal(reserved.order.amount,shown.total*10);
  assert.equal((await reserveOrder(input)).order?.id,reserved.order.id);
  await assert.rejects(() => reserveOrder({ ...input,attempt:randomUUID() }),/موجودی/);
  const held = (await product(a.id))!;
  await assert.rejects(() => saveProduct({ ...held,offers:[{ ...a.offer,stock:0 }] }),/رزرو/);
  const pending = await initiate(reserved.order);
  assert.equal((await verify(pending,"OK")).status,"paid");
  assert.equal((await verify(pending,"OK")).status,"paid");
  assert.equal((await verify(pending,"NOK")).status,"paid");
  assert.equal((await product(a.id))!.offers[0].stock,0);
  assert.equal((await product(a.id))!.offers[0].reserved,0);
});

test("دو تراکنش هم‌زمان برای آخرین واحد رقابت می‌کنند", async () => {
  const item = await inventory();
  const shown = await quote(item.lines,"تهران");
  const input = { lines:item.lines,customer,shown,mode:"simulator" as const };
  const outcomes = await Promise.allSettled([randomUUID(),randomUUID()].map((attempt) =>
    reserveOrder({ ...input,attempt })));
  const accepted = outcomes.filter((result) => result.status === "fulfilled");
  const rejected = outcomes.find((result) => result.status === "rejected");
  assert.equal(accepted.length,1);
  assert.match(String(rejected?.reason),/موجودی/);
  assert.equal((await product(item.id))!.offers[0].reserved,1);

  const concurrent = await inventory();
  const attempt = randomUUID();
  const duplicate = { ...input,lines:concurrent.lines,attempt };
  const [first,second] = await Promise.all([reserveOrder(duplicate),reserveOrder(duplicate)]);
  assert.ok(first.order);
  assert.equal(first.order.id,second.order?.id);
  assert.equal((await product(concurrent.id))!.offers[0].reserved,1);
});

test("قطع ارتباط درگاه و آزاد کردن موجودی پس از لغو قطعی", async (context) => {
  const a = await inventory();
  const shown = await quote(a.lines,"تهران");
  const reserved = (await reserveOrder({ lines:a.lines,customer,shown,attempt:randomUUID(),mode:"sandbox" })).order!;
  let stage = 0;
  context.mock.method(globalThis,"fetch",async (_url: string, init: RequestInit) => {
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.amount,shown.total*10);
    stage++;
    if (stage === 1) throw new Error("timeout");
    if (stage === 2) return Response.json({ data:{ code:100,authority:"sample-authority" } });
    assert.equal(payload.authority,"sample-authority");
    if (stage === 3) throw new Error("timeout");
    return Response.json({ errors:{ code:-51 } });
  });
  assert.equal((await initiate(reserved)).status,"review");
  assert.equal((await product(a.id))!.offers[0].reserved,1);
  const pending = await recheck((await order(reserved.id))!);
  assert.equal(pending.authority,"sample-authority");
  assert.equal((await verify(pending,"OK")).status,"review");
  assert.equal((await product(a.id))!.offers[0].reserved,1);
  assert.equal((await verify((await order(reserved.id))!,"NOK")).status,"canceled");
  assert.equal((await product(a.id))!.offers[0].reserved,0);
  assert.equal((await product(a.id))!.offers[0].stock,1);
});

test("سفارش و آدرس فقط برای حساب مالک نمایش داده می‌شوند", async () => {
  const buyer = randomUUID(), recipient = randomUUID();
  await db().query("INSERT INTO customers(id,mobile) VALUES ($1,$2),($3,$4)", [buyer,"09122222222",recipient,customer.mobile]);
  await db().query("INSERT INTO customer_addresses(id,customer_id,recipient) VALUES ($1,$2,$3)", [randomUUID(),buyer,customer]);
  const { lines } = await inventory(2);
  const input = { lines, customer, shown: await quote(lines,customer.province), attempt: randomUUID(), mode: "sandbox" as const };
  const placed = await reserveOrder({ ...input, customerId: buyer });
  await reserveOrder({ ...input, attempt: randomUUID() });
  assert.deepEqual((await customerOrders(buyer)).map(o => o.id), [placed.order!.id]);
  assert.deepEqual(await customerOrders(recipient), []);
  assert.deepEqual((await addresses(buyer))[0].recipient, customer);
  assert.deepEqual(await addresses(recipient), []);
  await assert.rejects(() => reserveOrder({ ...input, customerId: recipient }));
});

test("پرداخت مجدد سفارش لغوشده و بازگشت دیرهنگام پرداخت قبلی", async () => {
  const a = await inventory();
  const shown = await quote(a.lines, customer.province);
  const placed = await reserveOrder({ lines: a.lines, customer, shown, attempt: randomUUID(), mode: "simulator" });
  const first = await initiate(placed.order!);
  const canceled = await verify(first, "NOK");
  await Promise.all([resumePayment(canceled), resumePayment(canceled)]);
  const next = (await order(first.id))!;
  assert.ok(next.authority);
  assert.notEqual(next.authority, first.authority);
  assert.equal((await verify(first, "OK")).status, "pending");
  assert.equal((await product(a.id))!.offers[0].reserved, 1);
  const paid = await verify(next, "OK");
  assert.equal((await resumePayment(paid)).status, "paid");
  assert.equal((await product(a.id))!.offers[0].stock, 0);
});

test("لغو سفارش در انتظار بررسی، رزرو را یک‌بار آزاد می‌کند و پرداخت دوباره فعال نمی‌شود", async () => {
  const item = await inventory();
  const shown = await quote(item.lines, customer.province);
  const placed = await reserveOrder({ lines: item.lines, customer, shown, attempt: randomUUID(), mode: "simulator" });
  const pending = await initiate(placed.order!);
  const review = await verify(pending);
  assert.equal(review.status, "review");

  await db().query("UPDATE orders SET mode='live' WHERE id=$1", [review.id]);
  assert.equal(await cancelOrder(review.id), false);
  assert.equal((await product(item.id))!.offers[0].reserved, 1);
  await db().query("UPDATE orders SET mode='simulator' WHERE id=$1", [review.id]);

  assert.deepEqual(await Promise.all([cancelOrder(review.id), cancelOrder(review.id)]), [true, true]);
  const canceled = (await order(review.id))!;
  assert.equal(canceled.fulfillment_status, "canceled");
  assert.equal((await verify(review, "OK")).status, "canceled");
  assert.equal((await resumePayment(canceled)).status, "canceled");
  const { stock, reserved } = (await product(item.id))!.offers[0];
  assert.deepEqual({ stock, reserved }, { stock: 1, reserved: 0 });
});
