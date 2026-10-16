// The agent's key: the registry authority, the oracle that writes results, and the fee payer.
import fs from "node:fs";
import path from "node:path";
import { createPublicKey, verify } from "node:crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const g = globalThis as unknown as { __jamesAgentKey?: Keypair | null };

export function agentKeypair(): Keypair | null {
  if (g.__jamesAgentKey !== undefined) return g.__jamesAgentKey;
  let key: Keypair | null = null;
  try {
    const raw = process.env.AGENT_SECRET_KEY?.trim();
    if (raw) {
      key = raw.startsWith("[") ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw))) : Keypair.fromSecretKey(bs58.decode(raw));
    } else {
      const file = path.resolve(/*turbopackIgnore: true*/ process.env.AGENT_KEYPAIR_PATH ?? path.join(process.cwd(), ".keys", "agent.json"));
      if (fs.existsSync(file)) key = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
    }
  } catch (e) {
    console.error("[james] agent key could not be read:", e instanceof Error ? e.message : e);
  }
  g.__jamesAgentKey = key;
  return key;
}

const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** ed25519 check of a wallet's signMessage output, with Node's own crypto */
export function verifyWalletSignature(message: string, signatureB58: string, wallet: string): boolean {
  try {
    const pub = new PublicKey(wallet).toBytes();
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(pub)]), format: "der", type: "spki" });
    return verify(null, Buffer.from(message, "utf8"), key, Buffer.from(bs58.decode(signatureB58)));
  } catch {
    return false;
  }
}

export function isAddress(s: unknown): s is string {
  if (typeof s !== "string" || s.length < 32 || s.length > 44) return false;
  try {
    return PublicKey.isOnCurve(new PublicKey(s).toBytes());
  } catch {
    return false;
  }
}
