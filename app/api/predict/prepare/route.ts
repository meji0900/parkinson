export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { view } from "@/lib/agent/predict";
import { resolveGene } from "@/lib/agent/readers";
import { isAddress, normalAddress } from "@/lib/chain/keys";
import { prepareWalletSeal } from "@/lib/chain/oracle";
import { body, cleanGene, cleanName, fail, ok } from "@/lib/server/api";
import { limit } from "@/lib/server/ratelimit";

// Builds the typed data (EIP-712) a wallet signs to register a prediction. The agent submits it and pays the gas.
export async function POST(req: Request) {
  const b = await body<{ gene: string; group: string; axis: string; by: string; wallet: string }>(req);
  if (!isAddress(b.wallet)) return fail("connect a wallet first");
  const wallet = normalAddress(b.wallet);
  if (!limit(`prepare:${wallet}`, 15, 3600_000).ok) return fail("this wallet has prepared a lot of predictions; try again later", 429);
  try {
    const g = await resolveGene(cleanGene(b.gene));
    if (!g) return fail("that is not a human gene symbol on Open Targets");
    const r = await prepareWalletSeal({ gene: g.symbol, group: String(b.group ?? ""), axis: String(b.axis ?? ""), by: cleanName(b.by), wallet });
    return r.repeat ? ok({ repeat: true, result: view(r.exp, true) }) : ok({ repeat: false, registration: r.registration, typed: r.typed });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "could not prepare the prediction");
  }
}
