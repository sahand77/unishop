import type { MetadataRoute } from "next";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: publicUrl("/sitemap.xml") };
}
