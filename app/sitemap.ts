import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ rows: products }, { rows: categories }] = await Promise.all([
    db().query<{ id: string }>("SELECT id FROM products WHERE status='published' ORDER BY id"),
    db().query<{ id: string }>(`WITH RECURSIVE published_categories(id) AS (
      SELECT category_id FROM products WHERE status='published' AND category_id IS NOT NULL
      UNION SELECT c.parent_id FROM categories c JOIN published_categories p ON c.id=p.id WHERE c.parent_id IS NOT NULL
    ) SELECT id FROM published_categories ORDER BY id`),
  ]);
  return [
    { url: publicUrl("/") },
    ...products.map(({ id }) => ({ url: publicUrl(`/products/${encodeURIComponent(id)}`) })),
    ...categories.map(({ id }) => ({ url: publicUrl(`/?category=${encodeURIComponent(id)}`) })),
  ];
}
