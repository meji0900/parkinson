export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { listExperiments } from "@/lib/atlas/experiments";
import { cleanGene, ok } from "@/lib/server/api";
import { one } from "@/lib/server/db";

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const t = one<{ n: number; passed: number }>("select count(*) as n, coalesce(sum(passed), 0) as passed from experiments where state = 'tested'");
  return ok({
    count: t?.n ?? 0,
    passed: t?.passed ?? 0,
    results: listExperiments({ gene: cleanGene(p.get("gene")) || undefined, limit: Math.min(Number(p.get("limit") ?? 60) || 60, 500) }),
  });
}
