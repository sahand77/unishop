import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { rows } = await db().query<{ id: string; category_id: string | null }>(
    "SELECT id, category_id FROM products WHERE status='published' ORDER BY id"
  );
  const categories = new Set(rows.map(row => row.category_id).filter(Boolean));
  return [
    { url: publicUrl("/") },
    ...rows.map(row => ({ url: publicUrl(`/products/${encodeURIComponent(row.id)}`) })),
    ...Array.from(categories, id => ({ url: publicUrl(`/?category=${encodeURIComponent(id!)}`) })),
  ];
}
