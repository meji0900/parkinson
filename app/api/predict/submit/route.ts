export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { view } from "@/lib/agent/predict";
import { submitWalletSeal } from "@/lib/chain/oracle";
import { body, fail, ok } from "@/lib/server/api";

// Takes the wallet-signed transaction, adds the agent's signature, sends it, then tests the prediction.
export async function POST(req: Request) {
  const b = await body<{ registration: string; tx: string }>(req);
  if (typeof b.registration !== "string" || !/^[0-9a-f]{64}$/.test(b.registration) || typeof b.tx !== "string") return fail("missing registration or signed transaction");
  try {
    return ok(view(await submitWalletSeal(b.registration, b.tx)));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "the transaction did not go through");
  }
}
