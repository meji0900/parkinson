export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { chainStatus } from "@/lib/chain/oracle";
import { GATE_AMOUNT } from "@/lib/chain/config";
import { ok } from "@/lib/server/api";

export async function GET() {
  return ok({ gate_amount: GATE_AMOUNT, ...(await chainStatus()) });
}
