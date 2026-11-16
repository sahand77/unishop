import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { mediaFormats } from "@/lib/product-media";
import { dataDir } from "@/lib/uploads";

type Context = { params: Promise<{ file: string }> };

function byteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return;
  const start = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]),size-1) : size-1;
  if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < size) return { start,end };
}

export async function GET(request: Request, { params }: Context) {
  const { file } = await params;
  const format = /^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/.exec(file)?.[1] as keyof typeof mediaFormats | undefined;
  if (!format) return new Response(null,{ status: 404 });
  const path = join(dataDir(),"uploads",file);
  const asset = await stat(path).catch(() => null);
  if (!asset?.isFile()) return new Response(null,{ status: 404 });

  const headers = new Headers({
    "Content-Type": mediaFormats[format], "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes",
  });
  const range = request.headers.get("range");
  const partial = range ? byteRange(range, asset.size) : undefined;
  if (range && !partial) {
    headers.set("Content-Range",`bytes */${asset.size}`);
    return new Response(null,{ status:416,headers });
  }
  if (partial) {
    headers.set("Content-Range",`bytes ${partial.start}-${partial.end}/${asset.size}`);
    headers.set("Content-Length",String(partial.end-partial.start+1));
  } else {
    headers.set("Content-Length",String(asset.size));
  }
  const body = request.method === "HEAD" ? null
    : Readable.toWeb(createReadStream(path,partial)) as ReadableStream<Uint8Array>;
  return new Response(body,{ status:partial ? 206 : 200,headers });
}

export const HEAD = GET;
