export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getReceipt } from "@/lib/agent/receipts";
import { fail, ok } from "@/lib/server/api";
import { all } from "@/lib/server/db";

export async function GET(_: Request, ctx: { params: Promise<{ no: string }> }) {
  const no = Number((await ctx.params).no);
  const r = Number.isInteger(no) ? getReceipt(no) : null;
  if (!r) return fail("no such receipt", 404);
  const anchor = all<{ head_no: number; tx: string; at: string }>("select head_no, tx, at from anchors where head_no >= ? order by head_no limit 1", no)[0] ?? null;
  return ok({ receipt: r, anchor });
}
