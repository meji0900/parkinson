export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { chainStatus } from "@/lib/chain/oracle";
import { CLUSTER, GATE_AMOUNT, TOKEN_SYMBOL } from "@/lib/chain/config";
import { ok } from "@/lib/server/api";

export async function GET() {
  return ok({ cluster: CLUSTER, token: TOKEN_SYMBOL, gate: GATE_AMOUNT, ...(await chainStatus()) });
}
