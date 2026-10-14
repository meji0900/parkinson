export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { nextGene, nightly, workOne } from "@/lib/agent/worker";
import { anchorReceipts, syncOnchainPredictions } from "@/lib/chain/oracle";
import { fail, ok } from "@/lib/server/api";
import { setStatus } from "@/lib/server/events";

// For hosts without a long-running process (serverless): call this on a schedule.
//   GET /api/cron?task=tick|nightly|anchor|sync   with  Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key");
  if (!secret) return fail("set CRON_SECRET to use the cron endpoint", 403);
  if (given !== secret) return fail("unauthorized", 401);
  const task = url.searchParams.get("task") ?? "tick";
  if (task === "tick") {
    const next = await nextGene();
    if (!next) return ok({ task, gene: null });
    const rec = await workOne(next.gene, 0);
    setStatus({ state: "waiting", last: rec?.symbol ?? next.gene });
    return ok({ task, gene: rec?.symbol ?? next.gene, score: rec?.score ?? null });
  }
  if (task === "nightly") { await nightly(); return ok({ task }); }
  if (task === "anchor") return ok({ task, tx: await anchorReceipts(true) });
  if (task === "sync") return ok({ task, picked_up: await syncOnchainPredictions() });
  return fail("unknown task");
}
