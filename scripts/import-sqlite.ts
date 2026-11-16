import { DatabaseSync } from "node:sqlite";
import { closeDb, transaction } from "../lib/db";
import { migrate } from "../lib/migrations";

const tables = {
  admins: "id,username,password",
  categories: "id,name",
  products: "id,title,description,category_id,kind,status,image,attributes,updated",
  offers: "id,product_id,options,combination,price,stock,reserved,weight,sku,image,active,archived",
  shipping: "id,priority,config",
  orders: "id,attempt,secret,customer,quote,amount,authority,mode,status,reference,message,created,request_started",
};

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("مسیر فایل SQLite را وارد کنید.");
  const sqlite = new DatabaseSync(source,{ readOnly: true });
  try {
    await migrate();
    await transaction(async (client) => {
      for (const table of Object.keys(tables)) {
        if ((await client.query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount) {
          throw new Error("برای انتقال، دیتابیس PostgreSQL باید خالی باشد.");
        }
      }
      sqlite.exec("BEGIN");
      try {
        for (const [table,columns] of Object.entries(tables)) {
          const names = columns.split(",");
          const placeholders = names.map((_,index) => `$${index+1}`).join(",");
          for (const row of sqlite.prepare(`SELECT ${columns} FROM ${table} ORDER BY rowid`).iterate()) {
            await client.query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,names.map((column) => row[column]));
          }
        }
      } finally {
        sqlite.exec("ROLLBACK");
      }
    });
    console.log("داده‌های فروشگاه به PostgreSQL منتقل شدند.");
  } finally {
    sqlite.close();
  }
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; }).finally(closeDb);