import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { categories, product, saveCategory, saveProduct } from "../lib/catalog";
import { order, quote, reserveOrder } from "../lib/checkout";
import { db } from "../lib/db";
import { initiate, recheck, verify } from "../lib/payment";
import { rules, saveRule } from "../lib/shipping";

const temporary = mkdtempSync(join(tmpdir(),"unishop-test-"));
process.env.UNISHOP_DATA_DIR = temporary;
process.env.APP_URL = "http://127.0.0.1:3000";
after(() => { db().close(); rmSync(temporary,{ recursive:true,force:true }); });

const customer = { name:"مشتری نمونه", mobile:"09120000000", province:"تهران" as const,
  city:"تهران", address:"نشانی نمونه برای ارسال", postalCode:"1234567890" };
const baseOffer = { price:100000,weight:150,stock:1,sku:"",image:"",active:true,options:{} };
const baseRule = { id:"",name:"ارسال معمولی",priority:100,fee:20000,provinces:[],categories:[],
  minQuantity:null,maxQuantity:null,minWeight:null,maxWeight:null,minSubtotal:null,maxSubtotal:null };
const baseProduct = { title:"کالای آزمایشی",description:"",image:"",kind:"simple",status:"published",attributes:[] };
function inventory(stock = 1, categoryId = "") {
  const offer = { ...baseOffer,id:randomUUID(),sku:randomUUID(),stock };
  const id = saveProduct({ ...baseProduct,categoryId,offers:[offer] });
  return { id,offer,lines:[{ id:offer.id,quantity:1 }] };
}

test("قوانین ارسال هم‌زمان و مرزهای بازه", () => {
  saveCategory("","دیجیتال");
  saveCategory("","پوشاک");
  const groups = categories();
  const digital = groups.find((item) => item.name === "دیجیتال")!;
  const clothing = groups.find((item) => item.name === "پوشاک")!;
  const a = inventory(2,digital.id);
  const b = inventory(2,clothing.id);
  assert.throws(() => quote(a.lines,"یزد"),/روش ارسال/);
  saveRule(baseRule);
  saveRule({ ...baseRule,name:"ارسال سفارشی",fee:5000,priority:10,provinces:["تهران"],categories:[digital.id],
    minQuantity:2,maxQuantity:2,minWeight:300,maxWeight:300,minSubtotal:200000,maxSubtotal:200000 });
  saveRule({ ...baseRule,name:"تهران",fee:15000,priority:20,provinces:["تهران"] });
  const lines = [...a.lines,...b.lines];
  const matching = quote(lines,"تهران");
  assert.equal(matching.shipping,5000);
  assert.equal(matching.total,205000);
  assert.equal(quote(b.lines,"تهران").shipping,15000);
  assert.equal(quote(lines,"یزد").shipping,20000);
  assert.deepEqual(rules().map((item) => item.priority),[10,20,100]);
});

test("کالاهای پیش‌نویس و ترکیب‌های غیرفعال در خرید در دسترس نیستند", () => {
  const a = inventory();
  const item = product(a.id)!;
  saveProduct({ ...item,status:"draft" });
  assert.equal(product(a.id,true),undefined);
  assert.throws(() => quote(a.lines,"تهران"),/موجودی/);
  const attributes = [{ id:"size",name:"اندازه",values:[{ id:"s",name:"کوچک" },{ id:"l",name:"بزرگ" }] }];
  const active = { ...baseOffer,id:randomUUID(),sku:randomUUID(),options:{size:"s"} };
  const inactive = { ...baseOffer,id:randomUUID(),sku:randomUUID(),options:{size:"l"},active:false,price:0 };
  const input = { ...baseProduct,kind:"variable",categoryId:"",attributes,offers:[active,inactive] };
  const id = saveProduct(input);
  assert.throws(() => saveProduct({ ...input,id,offers:[active,{ ...inactive,options:{size:"s"} }] }),/یکتا/);
  assert.equal(product(id)!.offers.length,2);
  assert.throws(() => quote([{ id:inactive.id,quantity:1 }],"تهران"),/موجودی/);
});

test("تأیید مبلغ جدید، رزرو آخرین واحد، و تأیید تکراری پرداخت", async () => {
  const a = inventory();
  const shown = quote(a.lines,"تهران");
  const attempt = randomUUID();
  const input = { lines:a.lines,customer,shown,attempt,mode:"simulator" as const };
  const stale = reserveOrder({ ...input,shown:{ ...shown,total:shown.total-1 } });
  assert.equal(stale.changed?.total,shown.total);
  assert.equal(product(a.id)!.offers[0].reserved,0);
  const reserved = reserveOrder(input);
  assert.ok(reserved.order);
  assert.equal(reserved.order.amount,shown.total*10);
  assert.equal(reserveOrder(input).order?.id,reserved.order.id);
  assert.throws(() => reserveOrder({ ...input,attempt:randomUUID() }),/موجودی/);
  assert.throws(() => saveProduct({ ...product(a.id)!,offers:[{ ...a.offer,stock:0 }] }),/رزرو/);
  const pending = await initiate(reserved.order);
  assert.equal((await verify(pending,"OK")).status,"paid");
  assert.equal((await verify(pending,"OK")).status,"paid");
  assert.equal((await verify(pending,"NOK")).status,"paid");
  assert.equal(product(a.id)!.offers[0].stock,0);
  assert.equal(product(a.id)!.offers[0].reserved,0);
});

test("دو پردازش جداگانه برای آخرین واحد رقابت می‌کنند", async () => {
  const item = inventory();
  const shown = quote(item.lines,"تهران");
  const base = { lines:item.lines,customer,shown,mode:"simulator" };
  const run = promisify(execFile);
  const worker = [
    "const { reserveOrder } = require('./lib/checkout.ts');",
    "try { reserveOrder(JSON.parse(process.argv[1])); console.log('reserved'); }",
    "catch (error) { if (!error.message.includes('موجودی')) throw error; console.log('unavailable'); }",
  ].join("\n");
  const outcomes = await Promise.all([randomUUID(),randomUUID()].map((attempt) => run(process.execPath,[
    "--disable-warning=ExperimentalWarning","--import","tsx","-e",worker,JSON.stringify({ ...base,attempt }),
  ])));
  assert.deepEqual(outcomes.map((outcome) => outcome.stdout.trim()).sort(),["reserved","unavailable"]);
  assert.equal(product(item.id)!.offers[0].reserved,1);
});

test("قطع ارتباط درگاه و آزاد کردن موجودی پس از لغو قطعی", async (context) => {
  const a = inventory();
  const shown = quote(a.lines,"تهران");
  const reserved = reserveOrder({ lines:a.lines,customer,shown,attempt:randomUUID(),mode:"sandbox" }).order!;
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
  assert.equal(product(a.id)!.offers[0].reserved,1);
  const pending = await recheck(order(reserved.id)!);
  assert.equal(pending.authority,"sample-authority");
  assert.equal((await verify(pending,"OK")).status,"review");
  assert.equal(product(a.id)!.offers[0].reserved,1);
  assert.equal((await verify(order(reserved.id)!,"NOK")).status,"canceled");
  assert.equal(product(a.id)!.offers[0].reserved,0);
  assert.equal(product(a.id)!.offers[0].stock,1);
});