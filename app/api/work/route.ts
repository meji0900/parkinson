export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getWorkUnit, submitWorkUnit, workStatus } from "@/lib/compute";
import { body, ok } from "@/lib/server/api";
import { clientIp, limit } from "@/lib/server/ratelimit";

// Contributed compute over plain HTTP, for agents that do not speak MCP.
//   GET  /api/work            take a unit          GET /api/work?status=1   progress and contributors
//   POST /api/work            { study, unit, count, by }
export function GET(req: Request) {
  if (new URL(req.url).searchParams.get("status")) return ok(workStatus());
  return ok(getWorkUnit());
}

export async function POST(req: Request) {
  if (!limit(`work:${clientIp(req)}`, 120, 3600_000).ok) return ok({ accepted: false, error: "rate limited; try again later" }, { status: 429 });
  return ok(submitWorkUnit(await body<{ study: string; unit: number; count: number; by: string }>(req)));
}
