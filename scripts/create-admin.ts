import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { db } from "../lib/db";

async function main() {
  const username = (process.argv[2] || "").trim();
  if (!username || username.length > 100) throw new Error("نام مدیر را به عنوان آرگومان وارد کنید.");
  let password = process.env.UNISHOP_ADMIN_PASSWORD || "";
  if (!password) {
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      if (stdin.isTTY) throw new Error("رمز را از طریق متغیر محیطی UNISHOP_ADMIN_PASSWORD وارد کنید.");
      password = await prompt.question("");
    } finally {
      prompt.close();
    }
  }
  if (password.length < 12 || password.length > 128) throw new Error("رمز باید ۱۲ تا ۱۲۸ نویسه داشته باشد.");
  const salt = randomBytes(16).toString("hex");
  const hash = `${salt}:${scryptSync(password,salt,64).toString("hex")}`;
  db().prepare("INSERT INTO admins VALUES (?,?,?)").run(randomUUID(),username,hash);
  console.log("حساب مدیر ایجاد شد.");
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });