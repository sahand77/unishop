import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { currentAdmin } from "@/lib/auth";
import { imageLimit, videoLimit } from "@/lib/product-media";
import { dataDir } from "@/lib/uploads";

const requestLimit = videoLimit + 16 * 1024;

function detectFormat(bytes: Buffer) {
  if (bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) return "jpg";
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP") return "webp";
  if (bytes.toString("ascii",4,8) === "ftyp" && /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V )$/.test(bytes.toString("ascii",8,12))) return "mp4";
  if (bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) && bytes.subarray(4,64).includes(Buffer.from("webm"))) return "webm";
}

export async function POST(request: Request) {
  if (!(await currentAdmin())) return Response.json({ error: "ابتدا وارد پنل شوید." }, { status: 401 });
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin) {
    return Response.json({ error: "مبدأ بارگذاری معتبر نیست." }, { status: 403 });
  }

  const tooLarge = () => Response.json({ error: "حجم هر ویدئو باید حداکثر ۳۵ مگابایت باشد." }, { status: 413 });
  if (Number(request.headers.get("content-length")) > requestLimit) return tooLarge();
  if (!request.body) return Response.json({ error: "فایلی انتخاب نشده است." }, { status: 400 });

  let received = 0;
  const bounded = request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > requestLimit) controller.error(new Error("Upload exceeds limit"));
      else controller.enqueue(chunk);
    },
  }));
  const form = await new Response(bounded,{ headers:request.headers }).formData().catch(() => null);
  if (received > requestLimit) return tooLarge();
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 12) {
    return Response.json({ error: "یک عکس یا ویدئوی معتبر انتخاب کنید." }, { status: 400 });
  }

  const format = detectFormat(Buffer.from(await file.slice(0,64).arrayBuffer()));
  if (!format) return Response.json({ error: "فرمت‌های مجاز JPEG، PNG، WebP، MP4 و WebM هستند." }, { status: 400 });
  const kind = format === "mp4" || format === "webm" ? "video" : "image";
  if (kind === "image" && file.size > imageLimit) {
    return Response.json({ error: "حجم هر عکس باید حداکثر ۲ مگابایت باشد." }, { status: 413 });
  }
  if (file.size > videoLimit) return tooLarge();

  const name = `${randomUUID()}.${format}`;
  const directory = join(dataDir(),"uploads");
  await mkdir(directory,{ recursive: true });
  await writeFile(join(directory,name),Buffer.from(await file.arrayBuffer()),{ flag: "wx" });
  return Response.json({ url: `/uploads/${name}`,kind });
}
