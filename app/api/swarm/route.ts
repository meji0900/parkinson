export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { listCases, swarmStats } from "@/lib/atlas/swarm";
import { ok } from "@/lib/server/api";

export function GET() {
  const s = swarmStats();
  return ok({ ...s, cases: listCases(12) });
}
