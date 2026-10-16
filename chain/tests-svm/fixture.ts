// Writes fixture.json: the exact instructions the server would send, built by lib/chain/program.ts.
// The Rust harness (src/main.rs) replays them against the compiled program in LiteSVM.
//   npx -y tsx chain/tests-svm/fixture.ts && cd chain/tests-svm && cargo run --release
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Keypair, type TransactionInstruction } from "@solana/web3.js";
import { anchorIx, faucetIx, initializeIx, registerIx, resolveIx, rewardIx } from "../../lib/chain/program";
import { ataOf, mintPda, predictionPda, registryPda } from "../../lib/chain/config";

const seed = (n: number) => new Uint8Array(32).fill(n);
const keys = { agent: Keypair.fromSeed(seed(1)), wallet: Keypair.fromSeed(seed(2)), stranger: Keypair.fromSeed(seed(3)) };
const h1 = createHash("sha256").update("james-test-1").digest();
const h2 = createHash("sha256").update("james-test-2").digest();
const a = keys.agent.publicKey, w = keys.wallet.publicKey;

const ser = (ix: TransactionInstruction) => ({
  program: ix.programId.toBase58(),
  keys: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), signer: k.isSigner, writable: k.isWritable })),
  data: Buffer.from(ix.data).toString("hex"),
});
type K = keyof typeof keys;
const step = (name: string, ix: TransactionInstruction, signers: K[], ok: boolean) => ({ name, ...ser(ix), signers, ok });

const steps = [
  step("initialize", initializeIx(a, 50_000_000n, 250_000_000n), ["agent"], true),
  step("wallet registers a prediction (agent pays)", registerIx(h1, "LRRK2", 0, 0, w, a), ["agent", "wallet"], true),
  step("the same hash cannot be registered twice", registerIx(h1, "LRRK2", 0, 0, w, a), ["agent", "wallet"], false),
  step("a stranger cannot write the result", resolveIx(h1, true, 0.31, 0.42, 0, keys.stranger.publicKey), ["stranger"], false),
  step("the oracle writes the result", resolveIx(h1, true, 0.3141, 0.4242, 0, a), ["agent"], true),
  step("a result cannot be written twice", resolveIx(h1, false, 0, 0, 9, a), ["agent"], false),
  step("the predictor is rewarded", rewardIx(h1, w, a), ["agent"], true),
  step("a reward cannot be paid twice", rewardIx(h1, w, a), ["agent"], false),
  step("the agent seals its own prediction", registerIx(h2, "GBA1", 6, 2, a, a), ["agent"], true),
  step("a failed result is written", resolveIx(h2, false, -0.05, 0.1, 7, a), ["agent"], true),
  step("failed predictions earn nothing", rewardIx(h2, a, a), ["agent"], false),
  step("receipt head checkpoint", anchorIx(5, h1, a), ["agent"], true),
  step("checkpoints only move forward", anchorIx(5, h2, a), ["agent"], false),
  step("faucet pays a wallet", faucetIx(w, a), ["agent"], true),
  step("a stranger cannot run the faucet", faucetIx(w, keys.stranger.publicKey), ["stranger"], false),
];

const out = {
  program: "CfMeJtdS8jajhhFkNiguhLa3tjXBZdSJoKB3teWkxuYb",
  seeds: { agent: 1, wallet: 2, stranger: 3 },
  steps,
  dump: {
    registry: registryPda().toBase58(),
    prediction1: predictionPda(h1).toBase58(),
    prediction2: predictionPda(h2).toBase58(),
    walletAta: ataOf(w, mintPda()).toBase58(),
  },
};
fs.writeFileSync(path.join("chain", "tests-svm", "fixture.json"), JSON.stringify(out, null, 1));
console.log(`fixture: ${steps.length} steps`);
