export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { listReceipts, receiptCount } from "@/lib/agent/receipts";
import { cleanGene, ok } from "@/lib/server/api";

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const lim = Math.min(Number(p.get("limit") ?? 24) || 24, 200);
  return ok({ count: receiptCount(), receipts: listReceipts(lim, Number(p.get("before")) || undefined, cleanGene(p.get("gene")) || undefined) });
}
