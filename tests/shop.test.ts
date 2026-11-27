import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { categories, product, productPage, saveCategory, saveProduct } from "../lib/catalog";
import { categoryOptions, categoryPath, categoryTree } from "../lib/category-tree";
import { cancelOrder, cartAvailability, order, quote, reserveOrder } from "../lib/checkout";
import { Pool } from "pg";
import { addresses, customerOrders } from "../lib/profile";
import { db, closeDb } from "../lib/db";
import { saveDiscount, suggestDiscountCode } from "../lib/discounts";
import { saveCredential } from "../lib/integration-settings";
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

test("قیمت با تخفیف ذخیره و در سبد و سفارش اعمال می‌شود", async () => {
  const { id,offer,lines } = await inventory(2);
  const input = { ...baseProduct,id,categoryId:"",offers:[{ ...offer,salePrice:75000 }] };
  const shipping = { ...baseRule,id:randomUUID(),name:"ارسال کالای تخفیف‌دار",priority:0,fee:5000,
    minSubtotal:70000,maxSubtotal:80000 };
  await db().query("INSERT INTO shipping (id,priority,config) VALUES ($1,$2,$3)",
    [shipping.id,shipping.priority,JSON.stringify(shipping)]);
  try {
    assert.equal((await product(id))?.offers[0].salePrice,null);
    await assert.rejects(() => saveProduct({ ...input,offers:[{ ...offer,salePrice:offer.price }] }),
      /کمتر از قیمت اصلی/);
    await saveProduct(input);
    const saved = (await product(id))?.offers[0];
    assert.equal(saved?.price,100000);
    assert.equal(saved?.salePrice,75000);
    assert.deepEqual(await cartAvailability([offer.id]),[{ id:offer.id,available:2,price:75000 }]);
    const shown = await quote(lines,customer.province,customer.city);
    assert.equal(shown.items[0].price,75000);
    assert.equal(shown.subtotal,75000);
    const result = await reserveOrder({ lines,customer,shown,attempt:randomUUID(),mode:"simulator" });
    assert.ok(result.order);
    assert.equal(result.order.amount,800000);
    await saveProduct({ ...input,offers:[{ ...offer,salePrice:null }] });
    assert.equal((await product(id))?.offers[0].salePrice,null);
    assert.equal((await cartAvailability([offer.id]))[0].price,100000);
    assert.equal((await order(result.order.id))?.quote.items[0].price,75000);
  } finally {
    await db().query("DELETE FROM shipping WHERE id=$1",[shipping.id]);
  }
});

test("صفحه‌بندی کالا پس از اعمال فیلترهای فروشگاه انجام می‌شود", async () => {
  const category = randomUUID();
  await db().query("INSERT INTO categories (id,name) VALUES ($1,$2)",[category,"دستهٔ صفحه‌بندی"]);
  const result = await db().query<{ id: string }>(`
    INSERT INTO products (id,title,description,category_id,kind,status,image,attributes,updated)
    SELECT $1 || '-' || n, CASE WHEN n=15 THEN 'عنوان دیگر' ELSE 'كالای صفحه‌بندی' END,
      '', CASE WHEN n=16 THEN NULL ELSE $1 END, 'simple',
      CASE WHEN n=14 THEN 'draft' ELSE 'published' END, '', '[]', n
    FROM generate_series(1,16) AS series(n)
    RETURNING id`,[category]);
  try {
    const first = await productPage(1,true,category,"کالای");
    const second = await productPage(2,true,category,"کالای");
    assert.equal(first.hasNext,true);
    assert.deepEqual(first.items.map(item => item.id),Array.from({ length:12 },(_,i) => `${category}-${13 - i}`));
    assert.deepEqual(second.items.map(item => item.id),[`${category}-1`]);
    assert.equal(second.hasNext,false);
    assert.deepEqual(await productPage(3,true,category,"کالای"),{ items:[],hasNext:false });
    assert.equal((await productPage(1,false,category,"کالای")).items[0].status,"draft");
  } finally {
    await db().query("DELETE FROM products WHERE id=ANY($1::text[])",[result.rows.map(row => row.id)]);
    await db().query("DELETE FROM categories WHERE id=$1",[category]);
  }
});

test("دسته‌ها در چند سطح ساخته و جابه‌جا می‌شوند و کالاهای زیردسته در دستهٔ والد دیده می‌شوند", async () => {
  const names = ["دستهٔ درختی", "شاخهٔ میانی", "زیردستهٔ نهایی", "شاخهٔ مستقل"];
  const ids: string[] = [];
  const productId = randomUUID();
  async function create(name: string, parentId?: string) {
    await saveCategory("",name,parentId);
    const category = (await categories()).find(group => group.name === name)!;
    ids.push(category.id);
    return category;
  }
  try {
    const root = await create(names[0]);
    const branch = await create(names[1],root.id);
    const leaf = await create(names[2],branch.id);
    const other = await create(names[3]);
    const groups = await categories();
    assert.equal(root.parentId,null);
    assert.equal(categoryTree(groups).find(group => group.id === root.id)?.children[0].children[0].id,leaf.id);
    assert.deepEqual(categoryPath(groups,leaf.id).map(group => group.id),[root.id,branch.id,leaf.id]);
    assert.equal(categoryOptions(groups,branch.id).some(option => option.id === leaf.id),false);
    await assert.rejects(() => saveCategory(root.id,root.name,leaf.id),/بیرون این شاخه/);
    await assert.rejects(() => saveCategory(root.id,root.name,root.id),/بیرون این شاخه/);
    await assert.rejects(() => saveCategory("","دسته با والد نامعتبر",randomUUID()),/دستهٔ والد پیدا نشد/);
    await db().query(`INSERT INTO products (id,title,description,category_id,kind,status,image,attributes,updated)
      VALUES ($1,'کالای درختی','',$2,'simple','published','','[]',0)`,[productId,leaf.id]);
    assert.deepEqual((await productPage(1,true,root.id)).items.map(item => item.id),[productId]);
    assert.equal((await productPage(1,true,other.id)).items.length,0);
    await saveCategory(branch.id,branch.name,other.id);
    assert.equal((await productPage(1,true,root.id)).items.length,0);
    assert.deepEqual((await productPage(1,true,other.id)).items.map(item => item.id),[productId]);
    await saveCategory(branch.id,branch.name,"");
    assert.equal((await categories()).find(group => group.id === branch.id)?.parentId,null);
  } finally {
    await db().query("DELETE FROM products WHERE id=$1",[productId]);
    await db().query("DELETE FROM categories WHERE id=ANY($1::text[])",[ids]);
  }
});

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

test("تعرفهٔ شهر بر تعرفهٔ استان و تعرفهٔ سراسری مقدم است", async () => {
  const id = randomUUID();
  const item = await inventory();
  const regionalRule = { ...baseRule,id,fee:7500,priority:200,provinces:["البرز"] };
  await assert.rejects(() => saveRule({ ...regionalRule,cities:[{ province:"تهران",city:"کرج" }] }),/استان و شهر/);
  await saveRule({ ...regionalRule,cities:[{ province:"تهران",city:"تهران" }] });
  try {
    const cityQuote = await quote(item.lines,"تهران","تهران");
    const otherCityQuote = await quote(item.lines,"تهران","ورامین");
    assert.equal(cityQuote.shipping,7500);
    assert.equal(otherCityQuote.shipping,15000);
    assert.equal((await quote(item.lines,"البرز","کرج")).shipping,7500);
    const result = await reserveOrder({ lines:item.lines,customer,shown:otherCityQuote,attempt:randomUUID(),mode:"sandbox" });
    assert.equal(result.changed?.shipping,cityQuote.shipping);
    const saved = (await rules()).find(rule => rule.id === id)!;
    assert.deepEqual(saved.provinces,["البرز"]);
    await db().query("UPDATE shipping SET config=$1 WHERE id=$2",[JSON.stringify({ ...saved,provinces:["تهران"] }),id]);
    assert.deepEqual((await rules()).find(rule => rule.id === id)?.provinces,[]);
    assert.equal((await quote(item.lines,"تهران","ورامین")).shipping,15000);
    assert.equal((await quote(item.lines,"البرز","کرج")).shipping,20000);
  } finally {
    await db().query("DELETE FROM shipping WHERE id=$1",[id]);
  }
});

test("کد پیشنهادی هشت رقمی هنگام ذخیرهٔ فرم ثبت می‌شود", async () => {
  const code = await suggestDiscountCode();
  assert.match(code, /^[1-9]\d{7}$/);
  const discount = { code, pricing: { kind: "percent", value: 10 }, active: true };
  await saveDiscount(discount, false);
  await assert.rejects(() => saveDiscount(discount, false), /قبلاً ثبت شده/);
});

test("کد تخفیف در ثبت سفارش دوباره بررسی می‌شود و مبلغ آن در سفارش می‌ماند", async () => {
  const { lines } = await inventory();
  const code = "CHECKOUT_10";
  const discount = { code, pricing: { kind: "percent", value: 10 }, active: true };
  await saveDiscount(discount, false);
  await assert.rejects(() => saveDiscount({ ...discount, code: code.toLowerCase() }, false), /قبلاً ثبت شده/);

  const initial = await quote(lines, customer.province, customer.city, undefined, " checkout_10 ");
  assert.deepEqual(initial.discount, { code, amount: 10000 });
  assert.equal(initial.total, initial.subtotal + initial.shipping - 10000);
  const attempt = { lines, customer, discountCode: code, attempt: randomUUID(), mode: "simulator" as const };
  await saveDiscount({ ...discount, pricing: { kind: "fixed", value: 25000 } }, true);
  const changed = await reserveOrder({ ...attempt, shown: initial });
  assert.deepEqual(changed.changed?.discount, { code, amount: 25000 });
  assert.ok(changed.changed);

  const reserved = await reserveOrder({ ...attempt, shown: changed.changed });
  assert.ok(reserved.order);
  assert.equal(reserved.order.amount, changed.changed.total * 10);
  await saveDiscount({ ...discount, active: false }, true);
  assert.deepEqual((await order(reserved.order.id))?.quote.discount, { code, amount: 25000 });
  const retried = await reserveOrder({ ...attempt, shown: changed.changed });
  assert.equal(retried.order?.id, reserved.order.id);
  const other = await inventory();
  await assert.rejects(() => reserveOrder({ ...attempt, lines: other.lines, attempt: randomUUID(), shown: initial }), /غیرفعال/);
});

test("تخفیف ثابت حداکثر به اندازهٔ جمع کالاهاست و سفارش صفر تومانی موجودی را کم می‌کند", async () => {
  const id = randomUUID();
  const { lines, offer } = await inventory(2);
  await saveRule({ ...baseRule, id, fee: 0, priority: 0, provinces: ["تهران"] });
  try {
    const code = "FREE_CHECKOUT";
    await saveDiscount({ code, pricing: { kind: "fixed", value: 150000 }, active: true }, false);
    const shown = await quote(lines, customer.province, customer.city, undefined, code);
    assert.equal(shown.discount?.amount, shown.subtotal);
    assert.equal(shown.total, 0);
    const input = { lines, customer, shown, discountCode: code, attempt: randomUUID(), mode: "simulator" as const };
    const result = await reserveOrder(input);
    assert.equal(result.order?.status, "paid");
    assert.equal(result.order?.authority, null);
    assert.equal((await reserveOrder(input)).order?.id, result.order?.id);
    const { rows: [stock] } = await db().query("SELECT stock, reserved FROM offers WHERE id=$1", [offer.id]);
    assert.deepEqual(stock, { stock: 1, reserved: 0 });
  } finally {
    await db().query("DELETE FROM shipping WHERE id=$1", [id]);
  }
});

test("حداقل جمع کالاها و سقف تخفیف درصدی هنگام محاسبه و ثبت سفارش اعمال می‌شوند", async () => {
  const { lines } = await inventory(3);
  const code = "DISCOUNT_LIMITS";
  const discount = { code, pricing: { kind: "percent", value: 20 }, active: true, minSubtotal: 200000, maxDiscount: 50000 };
  const getQuote = (quantity: number) => quote([{ ...lines[0], quantity }], customer.province, customer.city, undefined, code);
  await saveDiscount({ ...discount, minSubtotal: 110000 }, false);
  await assert.rejects(() => getQuote(1), /جمع کالاهای سبد باید حداقل/);
  await saveDiscount(discount, true);
  assert.equal((await getQuote(2)).discount?.amount, 40000);
  const shown = await getQuote(3);
  assert.equal(shown.discount?.amount, 50000);

  const input = { lines: [{ ...lines[0], quantity: 3 }], customer, shown, discountCode: code,
    attempt: randomUUID(), mode: "simulator" as const };
  await saveDiscount({ ...discount, maxDiscount: 30000 }, true);
  const changed = await reserveOrder(input);
  assert.equal(changed.changed?.discount?.amount, 30000);
  assert.equal(changed.changed?.total, shown.total + 20000);

  await saveDiscount({ ...discount, pricing: { kind: "fixed", value: 60000 }, minSubtotal: 310000 }, true);
  await assert.rejects(() => reserveOrder(input), /جمع کالاهای سبد باید حداقل/);
  await saveDiscount({ ...discount, pricing: { kind: "fixed", value: 60000 } }, true);
  assert.equal((await getQuote(3)).discount?.amount, 60000);
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

test("پرداخت واقعی پس از تغییر شناسه با شناسهٔ اولیه تأیید می‌شود", async (context) => {
  const originalAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://shop.example";
  context.after(() => { process.env.APP_URL = originalAppUrl; });

  const merchant = randomUUID();
  await saveCredential("zarinpal", merchant);
  const { lines } = await inventory();
  const shown = await quote(lines, "تهران");
  const reserved = (await reserveOrder({ lines, customer, shown, attempt: randomUUID(), mode: "live" })).order!;
  const sent: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const payload = JSON.parse(String(init.body));
    sent.push(payload.merchant_id);
    return url.endsWith("/request.json")
      ? Response.json({ data: { code: 100, authority: "merchant-rotation-test" } })
      : Response.json({ data: { code: 100, ref_id: 12345 } });
  });

  const pending = await initiate(reserved);
  assert.equal(pending.authority, "merchant-rotation-test");
  await saveCredential("zarinpal", randomUUID());
  assert.equal((await verify(pending, "OK")).status, "paid");
  assert.deepEqual(sent, [merchant, merchant]);
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
