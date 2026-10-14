export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, ok } from "@/lib/server/api";
import { report, reportDays } from "@/lib/views";

export function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("day must be YYYY-MM-DD");
  return ok({ ...report(day), days: reportDays() });
}
