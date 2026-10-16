export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { exportTasks, gym } from "@/lib/atlas/gym";
import { ok } from "@/lib/server/api";

// The research gym. ?format=tasks exports every task as question / answer / metadata, so any agent or
// model can be scored on the same set.
export function GET(req: Request) {
  if (new URL(req.url).searchParams.get("format") === "tasks") return ok({ tasks: exportTasks() });
  return ok(gym());
}
