export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { agentProfile } from "@/lib/arena";
import { closedWindows } from "@/lib/atlas/forecasts";
import { listExperiments } from "@/lib/atlas/experiments";
import { fail, ok } from "@/lib/server/api";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id;
  const p = agentProfile(id);
  if (!p) return fail("no agent by that id", 404);
  return ok({ ...p, predictions: listExperiments({ agent: id, limit: 100 }), forecasts: closedWindows(50, { who: "agent:" + id }) });
}
