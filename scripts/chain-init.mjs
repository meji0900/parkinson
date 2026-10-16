// Initializes the deployed james_registry program: creates the registry account and the test-token mint,
// with the agent key as the authority (oracle). Run once after `npm run chain:deploy`.
//   node scripts/chain-init.mjs [rewardTokens=50] [faucetTokens=250]
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID ?? "CfMeJtdS8jajhhFkNiguhLa3tjXBZdSJoKB3teWkxuYb");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const keyFile = process.env.AGENT_KEYPAIR_PATH ?? path.join(process.cwd(), ".keys", "agent.json");
const agent = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyFile, "utf8"))));

const [reward = 50, faucet = 250] = process.argv.slice(2).map(Number);
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const disc = createHash("sha256").update("global:initialize").digest().subarray(0, 8);
const registry = PublicKey.findProgramAddressSync([Buffer.from("registry")], PROGRAM_ID)[0];
const mint = PublicKey.findProgramAddressSync([Buffer.from("mint")], PROGRAM_ID)[0];

const c = new Connection(RPC, "confirmed");
if (await c.getAccountInfo(registry)) {
  console.log("registry already initialized:", registry.toBase58());
  process.exit(0);
}
const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: registry, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: agent.publicKey, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc, u64(reward * 1e6), u64(faucet * 1e6)]),
});
const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash();
const tx = new VersionedTransaction(new TransactionMessage({ payerKey: agent.publicKey, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message());
tx.sign([agent]);
const sig = await c.sendTransaction(tx);
await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
console.log("initialized");
console.log("  registry ", registry.toBase58());
console.log("  mint     ", mint.toBase58());
console.log("  authority", agent.publicKey.toBase58());
console.log("  tx        https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
