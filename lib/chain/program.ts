// Instruction builders and account decoders for the engram_registry program, written by hand from the
// Rust source (Anchor discriminators are sha256("global:<ix>") and sha256("account:<Name>"), first 8 bytes).
import { createHash } from "node:crypto";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { ATA_PROGRAM_ID, PROGRAM_ID, TOKEN_PROGRAM_ID, ataOf, mintPda, predictionPda, registryPda } from "./config";

const disc = (kind: "global" | "account", name: string) => createHash("sha256").update(`${kind}:${name}`).digest().subarray(0, 8);
const u8 = (n: number) => Buffer.from([n & 0xff]);
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const i16 = (n: number) => { const b = Buffer.alloc(2); b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(n)))); return b; };
const u64 = (n: bigint | number) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const m = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({ pubkey, isSigner, isWritable });
const ix = (name: string, keys: ReturnType<typeof m>[], ...args: Buffer[]) =>
  new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.concat([disc("global", name), ...args]) });

export const GENE_LEN = 16;
export const geneBytes = (gene: string) => { const b = Buffer.alloc(GENE_LEN); b.write(gene.slice(0, GENE_LEN), "ascii"); return b; };

export const initializeIx = (authority: PublicKey, reward: bigint, faucet: bigint) =>
  ix("initialize", [m(registryPda(), false, true), m(mintPda(), false, true), m(authority, true, true), m(TOKEN_PROGRAM_ID, false, false), m(SystemProgram.programId, false, false)], u64(reward), u64(faucet));

export const registerIx = (hash: Buffer, gene: string, group: number, axis: number, predictor: PublicKey, payer: PublicKey) =>
  ix("register_prediction", [m(registryPda(), false, true), m(predictionPda(hash), false, true), m(predictor, true, false), m(payer, true, true), m(SystemProgram.programId, false, false)],
    hash, geneBytes(gene), u8(group), u8(axis));

export const resolveIx = (hash: Buffer, passed: boolean, effD: number, effR: number, receipt: number, authority: PublicKey) =>
  ix("resolve_prediction", [m(registryPda(), false, true), m(predictionPda(hash), false, true), m(authority, true, false)],
    u8(passed ? 1 : 0), i16(effD * 10000), i16(effR * 10000), u32(receipt));

export const rewardIx = (hash: Buffer, predictor: PublicKey, authority: PublicKey) => {
  const mint = mintPda();
  return ix("reward_predictor", [
    m(registryPda(), false, false), m(predictionPda(hash), false, true), m(mint, false, true), m(predictor, false, false),
    m(ataOf(predictor, mint), false, true), m(authority, true, true), m(TOKEN_PROGRAM_ID, false, false), m(ATA_PROGRAM_ID, false, false),
    m(SystemProgram.programId, false, false),
  ]);
};

export const anchorIx = (headNo: number, headHash: Buffer, authority: PublicKey) =>
  ix("anchor_receipts", [m(registryPda(), false, true), m(authority, true, false)], u64(headNo), headHash);

export const faucetIx = (recipient: PublicKey, authority: PublicKey) => {
  const mint = mintPda();
  return ix("faucet", [
    m(registryPda(), false, false), m(mint, false, true), m(recipient, false, false), m(ataOf(recipient, mint), false, true),
    m(authority, true, true), m(TOKEN_PROGRAM_ID, false, false), m(ATA_PROGRAM_ID, false, false), m(SystemProgram.programId, false, false),
  ]);
};

// ---------------------------------------------------------------- account decoding
export type RegistryAccount = {
  authority: string; mint: string; predictions: number; resolved: number; replicated: number;
  receiptHeadNo: number; receiptHeadHash: string; anchoredAt: number; rewardAmount: number; faucetAmount: number;
};

export function decodeRegistry(data: Buffer): RegistryAccount | null {
  if (data.length < 8 || !data.subarray(0, 8).equals(disc("account", "Registry"))) return null;
  let o = 8;
  const pk = () => { const v = new PublicKey(data.subarray(o, o + 32)).toBase58(); o += 32; return v; };
  const n64 = () => { const v = Number(data.readBigUInt64LE(o)); o += 8; return v; };
  const authority = pk(), mint = pk();
  o += 2; // bump, mint_bump
  const predictions = n64(), resolved = n64(), replicated = n64(), receiptHeadNo = n64();
  const receiptHeadHash = data.subarray(o, o + 32).toString("hex"); o += 32;
  const anchoredAt = Number(data.readBigInt64LE(o)); o += 8;
  return { authority, mint, predictions, resolved, replicated, receiptHeadNo, receiptHeadHash, anchoredAt, rewardAmount: n64(), faucetAmount: n64() };
}

export type PredictionAccount = {
  hash: string; predictor: string; gene: string; group: number; axis: number; registeredAt: number; slot: number;
  status: "pending" | "replicated" | "failed"; effectDiscovery: number; effectReplication: number; receiptNo: number; resolvedAt: number; rewarded: boolean;
};

export function decodePrediction(data: Buffer): PredictionAccount | null {
  if (data.length < 8 || !data.subarray(0, 8).equals(disc("account", "Prediction"))) return null;
  let o = 8;
  const hash = data.subarray(o, o + 32).toString("hex"); o += 32;
  const predictor = new PublicKey(data.subarray(o, o + 32)).toBase58(); o += 32;
  const gene = data.subarray(o, o + GENE_LEN).toString("ascii").replace(/\0+$/, ""); o += GENE_LEN;
  const group = data[o++], axis = data[o++];
  const registeredAt = Number(data.readBigInt64LE(o)); o += 8;
  const slot = Number(data.readBigUInt64LE(o)); o += 8;
  const status = (["pending", "replicated", "failed"] as const)[data[o++]] ?? "pending";
  const effectDiscovery = data.readInt16LE(o) / 10000; o += 2;
  const effectReplication = data.readInt16LE(o) / 10000; o += 2;
  const receiptNo = data.readUInt32LE(o); o += 4;
  const resolvedAt = Number(data.readBigInt64LE(o)); o += 8;
  return { hash, predictor, gene, group, axis, registeredAt, slot, status, effectDiscovery, effectReplication, receiptNo, resolvedAt, rewarded: data[o] === 1 };
}

export const PREDICTION_DISC = () => disc("account", "Prediction");
