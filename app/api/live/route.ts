export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { queueLength, workerStarted } from "@/lib/agent/worker";
import { ok } from "@/lib/server/api";
import { eventsAfter, getStatus } from "@/lib/server/events";

export function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  return ok({ status: { ...getStatus(), queue: queueLength(), worker: workerStarted() }, events: eventsAfter(after) });
}
