// Chain constants shared by the server and the browser.
import { PublicKey } from "@solana/web3.js";

export const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as "devnet" | "testnet" | "mainnet-beta";
export const PUBLIC_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID ?? "7WZ76mDSPhihpu6fCxejbKbaffVJKxedcjb4jGNnEADn");
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "tENGRAM";
/** test tokens a wallet must hold to put a gene at the front of the agent's queue */
export const GATE_AMOUNT = Number(process.env.NEXT_PUBLIC_GATE_AMOUNT ?? 100);

const enc = (s: string) => new TextEncoder().encode(s);
export const registryPda = () => PublicKey.findProgramAddressSync([enc("registry")], PROGRAM_ID)[0];
export const mintPda = () => PublicKey.findProgramAddressSync([enc("mint")], PROGRAM_ID)[0];
export const predictionPda = (hash: Uint8Array) => PublicKey.findProgramAddressSync([enc("prediction"), hash], PROGRAM_ID)[0];
export const ataOf = (owner: PublicKey, mint: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()], ATA_PROGRAM_ID)[0];

export const explorer = (kind: "tx" | "address", id: string) =>
  `https://explorer.solana.com/${kind}/${id}${CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`}`;

export const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));

/** the message a wallet signs to prove it is asking (faucet, queue) */
export const proofMessage = (action: string, wallet: string, extra: Record<string, string> = {}) =>
  [`engram ${action}`, `wallet: ${wallet}`, ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`), `day: ${new Date().toISOString().slice(0, 10)}`].join("\n");
