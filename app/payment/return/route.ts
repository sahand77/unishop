import { order } from "@/lib/checkout";
import { receiptPath, verify } from "@/lib/payment";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const item = await order(query.get("id") || "");
  if (!item || item.mode === "simulator" || !item.authority || item.secret !== query.get("token")
      || item.authority !== query.get("Authority")) {
    return new Response("نشانی بازگشت پرداخت معتبر نیست.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const result = await verify(item,query.get("Status") || undefined);
  return new Response(null,{ status: 303, headers: { Location: receiptPath(result), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}