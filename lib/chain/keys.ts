// The agent's key: the registry's oracle, the payer of the gas for wallet predictions and the faucet, and the sender
// of its own seals. On a host it comes from SIGNER_PRIVATE_KEY; on this machine from the encrypted Foundry keystore in
// .keys (npm run wallet:new), unlocked with its password file. The key itself is never printed.
import fs from "node:fs";
import path from "node:path";
import { createDecipheriv, pbkdf2Sync, scryptSync } from "node:crypto";
import { getAddress, isAddress as isEvmAddress, keccak256, nonceManager, verifyMessage, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

const g = globalThis as unknown as { __parkinsonSigner?: PrivateKeyAccount | null };

export function agentAccount(): PrivateKeyAccount | null {
  if (g.__parkinsonSigner !== undefined) return g.__parkinsonSigner;
  let account: PrivateKeyAccount | null = null;
  try {
    const raw = process.env.SIGNER_PRIVATE_KEY?.trim();
    const key = raw ? (raw.startsWith("0x") ? raw : `0x${raw}`) : fromKeystore();
    // the nonce manager lets the agent send several transactions at once without two taking the same nonce
    if (key) account = privateKeyToAccount(key as Hex, { nonceManager });
  } catch (e) {
    console.error("[parkinson] signer key could not be read:", e instanceof Error ? e.message : e);
  }
  g.__parkinsonSigner = account;
  return account;
}

/** Web3 Secret Storage v3, the format `cast wallet new` writes */
function fromKeystore(): Hex | null {
  const file = path.resolve(/*turbopackIgnore: true*/ process.env.SIGNER_KEYSTORE ?? path.join(process.cwd(), ".keys", "evm-testnet"));
  if (!fs.existsSync(file)) return null;
  const password = fs.readFileSync(path.resolve(/*turbopackIgnore: true*/ process.env.SIGNER_PASSWORD_FILE ?? `${file}.pass`), "utf8").trim();
  const { crypto: c } = JSON.parse(fs.readFileSync(file, "utf8"));
  const k = c.kdfparams;
  const salt = Buffer.from(k.salt, "hex");
  const dk = c.kdf === "scrypt"
    ? scryptSync(password, salt, k.dklen, { N: k.n, r: k.r, p: k.p, maxmem: 256 * k.n * k.r })
    : pbkdf2Sync(password, salt, k.c, k.dklen, "sha256");
  const ct = Buffer.from(c.ciphertext, "hex");
  if (keccak256(Buffer.concat([dk.subarray(16, 32), ct])).slice(2) !== c.mac) throw new Error("the keystore password does not match");
  const d = createDecipheriv("aes-128-ctr", dk.subarray(0, 16), Buffer.from(c.cipherparams.iv, "hex"));
  return `0x${Buffer.concat([d.update(ct), d.final()]).toString("hex")}`;
}

export const isAddress = (s: unknown): s is string => typeof s === "string" && isEvmAddress(s, { strict: false });
/** one spelling per wallet (EIP-55), so rate limits and the leaderboard see a wallet once */
export const normalAddress = (s: string) => getAddress(s);

/** an EIP-191 signature from a wallet; contract wallets (EIP-1271) are checked through the chain */
export async function verifyWalletSignature(message: string, signature: unknown, wallet: string): Promise<boolean> {
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130,}$/.test(signature)) return false;
  const args = { address: wallet as Address, message, signature: signature as Hex };
  try {
    if (await verifyMessage(args)) return true;
    const { publicClient } = await import("./oracle");
    return await publicClient().verifyMessage(args);
  } catch {
    return false;
  }
}
