export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { cleanGene, fail, ok } from "@/lib/server/api";
import { geneRecord } from "@/lib/views";

export async function GET(_: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const g = cleanGene((await ctx.params).symbol);
  if (!g) return fail("bad gene symbol");
  return ok(geneRecord(g));
}
