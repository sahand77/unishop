import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { currentAdmin } from "@/lib/auth";
import { dataDir } from "@/lib/db";

const maxSize = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await currentAdmin())) return Response.json({ error: "ابتدا وارد پنل شوید." }, { status: 401 });
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin) {
    return Response.json({ error: "مبدأ بارگذاری معتبر نیست." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length"));
  if (length > maxSize + 16384) return Response.json({ error: "حجم تصویر باید حداکثر ۲ مگابایت باشد." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size > maxSize || file.size < 12) {
    return Response.json({ error: "یک تصویر تا ۲ مگابایت انتخاب کنید." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? "jpg"
    : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "png"
    : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP" ? "webp" : "";
  if (!type) return Response.json({ error: "فرمت تصویر باید JPEG، PNG یا WebP باشد." }, { status: 400 });
  const name = `${randomUUID()}.${type}`;
  const directory = join(dataDir(),"uploads");
  await mkdir(directory,{ recursive: true });
  await writeFile(join(directory,name),bytes,{ flag: "wx" });
  return Response.json({ url: `/uploads/${name}` });
}