export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { view } from "@/lib/agent/predict";
import { resolveGene } from "@/lib/agent/readers";
import { isAddress } from "@/lib/chain/keys";
import { prepareWalletSeal } from "@/lib/chain/oracle";
import { body, cleanGene, cleanName, fail, ok } from "@/lib/server/api";
import { limit } from "@/lib/server/ratelimit";

// Builds the registration transaction for a wallet to sign. The agent pays the fee and the account rent.
export async function POST(req: Request) {
  const b = await body<{ gene: string; group: string; axis: string; by: string; wallet: string }>(req);
  if (!isAddress(b.wallet)) return fail("connect a Solana wallet first");
  if (!limit(`prepare:${b.wallet}`, 15, 3600_000).ok) return fail("this wallet has prepared a lot of predictions; try again later", 429);
  try {
    const g = await resolveGene(cleanGene(b.gene));
    if (!g) return fail("that is not a human gene symbol on Open Targets");
    const r = await prepareWalletSeal({ gene: g.symbol, group: String(b.group ?? ""), axis: String(b.axis ?? ""), by: cleanName(b.by), wallet: b.wallet });
    return r.repeat ? ok({ repeat: true, result: view(r.exp, true) }) : ok({ repeat: false, registration: r.registration, tx: r.tx });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "could not prepare the transaction");
  }
}
