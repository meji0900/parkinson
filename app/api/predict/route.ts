export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { predict } from "@/lib/agent/predict";
import { body, cleanGene, cleanName, fail, ok } from "@/lib/server/api";
import { clientIp, limit } from "@/lib/server/ratelimit";

export async function POST(req: Request) {
  const b = await body<{ gene: string; group: string; axis: string; by: string }>(req);
  if (!limit(`predict:${clientIp(req)}`, 20, 3600_000).ok) return fail("twenty predictions an hour is the limit; try again later", 429);
  try {
    return ok(await predict({ gene: cleanGene(b.gene), group: String(b.group ?? ""), axis: String(b.axis ?? ""), by: cleanName(b.by), source: "visitor" }));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "could not register that prediction");
  }
}
