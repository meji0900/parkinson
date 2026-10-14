export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { proofMessage } from "@/lib/chain/config";
import { isAddress, verifyWalletSignature } from "@/lib/chain/keys";
import { faucet } from "@/lib/chain/oracle";
import { body, fail, ok } from "@/lib/server/api";
import { nowIso, one, run } from "@/lib/server/db";
import { clientIp } from "@/lib/server/ratelimit";

// Test tokens, once a day per wallet. The wallet signs a short message so nobody claims for addresses
// they do not hold.
export async function POST(req: Request) {
  const b = await body<{ wallet: string; signature: string }>(req);
  if (!isAddress(b.wallet) || typeof b.signature !== "string") return fail("connect a wallet and sign the message");
  if (!verifyWalletSignature(proofMessage("faucet", b.wallet), b.signature, b.wallet)) return fail("the signature does not match this wallet", 401);
  const since = new Date(Date.now() - 864e5).toISOString();
  if (one("select 1 from faucet where wallet = ? and at > ?", b.wallet, since)) return fail("this wallet already claimed today", 429);
  const ip = clientIp(req);
  if ((one<{ n: number }>("select count(*) as n from faucet where ip = ? and at > ?", ip, since)?.n ?? 0) >= 3) return fail("three claims a day per connection", 429);
  try {
    const tx = await faucet(b.wallet);
    run("insert into faucet (wallet, ip, at, tx) values (?, ?, ?, ?)", b.wallet, ip, nowIso(), tx);
    return ok({ tx });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "faucet failed", 503);
  }
}
