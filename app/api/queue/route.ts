export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { resolveGene } from "@/lib/agent/readers";
import { enqueue } from "@/lib/agent/worker";
import { GATE_AMOUNT, GATE_TOKEN, proofMessage, TOKEN_SYMBOL } from "@/lib/chain/config";
import { isAddress, normalAddress, verifyWalletSignature } from "@/lib/chain/keys";
import { tokenBalance } from "@/lib/chain/oracle";
import { body, cleanGene, fail, ok } from "@/lib/server/api";
import { one } from "@/lib/server/db";
import { limit } from "@/lib/server/ratelimit";

// Token holders put a gene at the front of the agent's live queue.
export async function POST(req: Request) {
  const b = await body<{ gene: string; wallet: string; signature: string }>(req);
  const gene = cleanGene(b.gene);
  if (!gene || !isAddress(b.wallet) || typeof b.signature !== "string") return fail("gene, wallet and signature are required");
  if (!GATE_TOKEN) return fail(`the queue opens once ${TOKEN_SYMBOL} is live on this network`, 503);
  const wallet = normalAddress(b.wallet);
  if (!(await verifyWalletSignature(proofMessage("queue", wallet, { gene }), b.signature, wallet))) return fail("the signature does not match this wallet", 401);
  if (!limit(`queue:${wallet}`, 5, 864e5).ok) return fail("five queued genes a day per wallet", 429);
  const balance = await tokenBalance(wallet);
  if (balance < GATE_AMOUNT) return fail(`queueing needs ${GATE_AMOUNT} ${TOKEN_SYMBOL}; this wallet holds ${balance}`, 403);
  const g = await resolveGene(gene).catch(() => null);
  if (!g) return fail("that is not a human gene symbol on Open Targets");
  enqueue(g.symbol, "holder", wallet);
  const position = one<{ n: number }>("select count(*) as n from queue where done = 0 and source = 'holder'")?.n ?? 1;
  return ok({ gene: g.symbol, position, balance });
}
