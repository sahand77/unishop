import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const format = /^[a-f0-9-]{36}\.(jpg|png|webp)$/.exec(file)?.[1];
  if (!format) return new Response(null,{ status: 404 });
  const image = await readFile(join(dataDir(),"uploads",file)).catch(() => null);
  if (!image) return new Response(null,{ status: 404 });
  return new Response(new Uint8Array(image), { headers: {
    "Content-Type": `image/${format === "jpg" ? "jpeg" : format}`,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  } });
}