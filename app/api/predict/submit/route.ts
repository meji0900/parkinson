export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { view } from "@/lib/agent/predict";
import { submitWalletSeal } from "@/lib/chain/oracle";
import { body, fail, ok } from "@/lib/server/api";

// Takes the wallet's signature, registers the prediction on-chain (the agent pays the gas), then tests it.
export async function POST(req: Request) {
  const b = await body<{ registration: string; signature: string }>(req);
  if (typeof b.registration !== "string" || !/^[0-9a-f]{64}$/.test(b.registration) || typeof b.signature !== "string") return fail("missing registration or signature");
  try {
    return ok(view(await submitWalletSeal(b.registration, b.signature)));
  } catch (e) {
    const m = (e as { shortMessage?: string })?.shortMessage ?? (e instanceof Error ? e.message : "");
    return fail(m || "the registration did not go through");
  }
}
