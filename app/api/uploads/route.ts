import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { currentAdmin } from "@/lib/auth";
import { dataDir } from "@/lib/uploads";

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

  if (!request.body) return Response.json({ error: "فایلی انتخاب نشده است." }, { status: 400 });

  const invalidFile = () => Response.json({ error: "یک عکس یا ویدئوی معتبر انتخاب کنید." }, { status: 400 });
  let body = request.body;
  if (request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase() !== "application/octet-stream") {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return invalidFile();
    body = file.stream();
  }

  const header = Buffer.alloc(64);
  let headerLength = 0;
  const unsupportedFormat = new Error("Unsupported media format");
  const inspect = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (headerLength < header.length) {
        headerLength += chunk.copy(header,headerLength,0,header.length - headerLength);
        if (headerLength === header.length && !detectFormat(header)) return callback(unsupportedFormat);
      }
      callback(null,chunk);
    },
  });

  const id = randomUUID();
  const directory = join(dataDir(),"uploads");
  const temporary = join(directory,`${id}.tmp`);
  await mkdir(directory,{ recursive: true });
  try {
    await pipeline(
      Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
      inspect,
      createWriteStream(temporary,{ flags:"wx" }),
      { signal: request.signal },
    );
    if (headerLength < 12) return invalidFile();
    const format = detectFormat(header.subarray(0,headerLength));
    if (!format) throw unsupportedFormat;

    const name = `${id}.${format}`;
    const kind = format === "mp4" || format === "webm" ? "video" : "image";
    await rename(temporary,join(directory,name));
    return Response.json({ url: `/uploads/${name}`,kind });
  } catch (error) {
    if (error !== unsupportedFormat) throw error;
    return Response.json({ error: "فرمت‌های مجاز JPEG، PNG، WebP، MP4 و WebM هستند." }, { status: 400 });
  } finally {
    await rm(temporary,{ force:true });
  }
}
