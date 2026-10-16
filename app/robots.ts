import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const site = BRAND.siteUrl.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/mcp"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
