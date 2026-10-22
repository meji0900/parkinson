export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { CHAIN, NETWORK, proofMessage } from "@/lib/chain/config";
import { isAddress, normalAddress, verifyWalletSignature } from "@/lib/chain/keys";
import { faucet } from "@/lib/chain/oracle";
import { body, fail, ok } from "@/lib/server/api";
import { nowIso, one, run } from "@/lib/server/db";
import { clientIp } from "@/lib/server/ratelimit";

// Test tokens, once a day per wallet. The wallet signs a short message so nobody claims for addresses
// they do not hold. Mainnet has no faucet.
export async function POST(req: Request) {
  if (NETWORK === "mainnet") return fail("the faucet only runs on the testnet", 404);
  const b = await body<{ wallet: string; signature: string }>(req);
  if (!isAddress(b.wallet) || typeof b.signature !== "string") return fail("connect a wallet and sign the message");
  const wallet = normalAddress(b.wallet);
  if (!(await verifyWalletSignature(proofMessage("faucet", wallet), b.signature, wallet))) return fail("the signature does not match this wallet", 401);
  const since = new Date(Date.now() - 864e5).toISOString();
  if (one("select 1 from faucet where wallet = ? and at > ?", wallet, since)) return fail("this wallet already claimed today", 429);
  const ip = clientIp(req);
  if ((one<{ n: number }>("select count(*) as n from faucet where ip = ? and at > ?", ip, since)?.n ?? 0) >= 3) return fail("three claims a day per connection", 429);
  try {
    const tx = await faucet(wallet);
    run("insert into faucet (wallet, ip, at, tx, chain) values (?, ?, ?, ?, ?)", wallet, ip, nowIso(), tx, String(CHAIN.id));
    return ok({ tx, chain: CHAIN.id });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "faucet failed", 503);
  }
}
