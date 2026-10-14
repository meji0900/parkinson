export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { view } from "@/lib/agent/predict";
import { AXES, GROUPS } from "@/lib/atlas/cohort";
import { getExperiment } from "@/lib/atlas/experiments";
import { ok } from "@/lib/server/api";
import { all, one } from "@/lib/server/db";

// visitor predictions, newest first (a repeat of an earlier registration shows the recorded result)
export function GET() {
  const rows = all<{ at: string; registration: string; by: string | null; repeat: number }>("select at, registration, by, repeat from visits order by id desc limit 40");
  return ok({
    count: one<{ n: number }>("select count(*) as n from visits")?.n ?? 0,
    groups: GROUPS,
    axes: AXES,
    rows: rows.flatMap((r) => {
      const e = getExperiment(r.registration);
      return e ? [{ ...view(e, !!r.repeat), at: r.at, by: r.by ?? e.by }] : [];
    }),
  });
}
