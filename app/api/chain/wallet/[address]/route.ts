export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { view } from "@/lib/agent/predict";
import { listExperiments } from "@/lib/atlas/experiments";
import { isAddress } from "@/lib/chain/keys";
import { tokenBalance } from "@/lib/chain/oracle";
import { fail, ok } from "@/lib/server/api";
import { all } from "@/lib/server/db";

export async function GET(_: Request, ctx: { params: Promise<{ address: string }> }) {
  const wallet = (await ctx.params).address;
  if (!isAddress(wallet)) return fail("not a Solana address");
  return ok({
    wallet,
    balance: await tokenBalance(wallet),
    predictions: listExperiments({ wallet, limit: 50 }).map((e) => view(e)),
    faucet: all<{ at: string; tx: string }>("select at, tx from faucet where wallet = ? order by id desc limit 5", wallet),
    queued: all<{ gene: string; at: string; done: number }>("select gene, at, done from queue where wallet = ? order by id desc limit 10", wallet),
  });
}
