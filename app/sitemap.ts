import type { MetadataRoute } from "next";
import { BRAND, MORE, NAV } from "@/lib/brand";
import { all } from "@/lib/server/db";

// Read from the ledger on each request, so new gene pages are listed as the agent reads them.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = BRAND.siteUrl.replace(/\/$/, "");
  const pages = ["/", ...[...NAV, ...MORE].map((n) => n.href).filter((h) => !h.startsWith("/#"))];
  const genes = all<{ symbol: string; at: string }>("select symbol, max(at) as at from runs group by symbol order by symbol");
  const agents = all<{ id: string; at: string }>("select id, at from agents order by at");
  return [
    ...pages.map((p) => ({ url: site + p, changeFrequency: "daily" as const, priority: p === "/" ? 1 : 0.7 })),
    ...genes.map((g) => ({ url: `${site}/gene/${encodeURIComponent(g.symbol)}`, lastModified: g.at, changeFrequency: "daily" as const, priority: 0.4 })),
    ...agents.map((a) => ({ url: `${site}/arena/${a.id}`, lastModified: a.at, changeFrequency: "daily" as const, priority: 0.4 })),
  ];
}
