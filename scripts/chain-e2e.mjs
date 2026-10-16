// End-to-end check of the on-chain side against a running server, with a single wallet: the agent key
// (.keys/agent.json) also plays the visitor. Every step's cost is read from its own transaction (balance
// before and after), so the agent's background memos on the same wallet do not blur the numbers.
//   node scripts/chain-e2e.mjs [base url]
import fs from "node:fs";
import path from "node:path";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID ?? "CfMeJtdS8jajhhFkNiguhLa3tjXBZdSJoKB3teWkxuYb");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const COHORT = process.env.COHORT ?? "sim-snpc-v2";
const GROUPS = ["dopamine neurons", "GABA neurons", "glutamate neurons", "microglia", "astrocytes", "oligodendrocytes", "OPCs", "endothelial"];
const AXES = ["braak", "nigra", "resilience"];
// held in both donor halves on the simulated cohort, so the wallet path reaches "replicated" and the reward
const HOLDS = ["SLC6A3", "PACRG", "NR1H2", "MASTL"].map((gene) => ({ gene, group: "dopamine neurons", axis: "braak" }));

const keyFile = process.env.AGENT_KEYPAIR_PATH ?? path.join(process.cwd(), ".keys", "agent.json");
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyFile, "utf8"))));
const wallet = kp.publicKey.toBase58();
const c = new Connection(RPC, "confirmed");

// ---------------------------------------------------------------- helpers
const pda = (...seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const registry = pda(Buffer.from("registry")), mint = pda(Buffer.from("mint"));
const ata = PublicKey.findProgramAddressSync([kp.publicKey.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()], ATA_PROGRAM_ID)[0];
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const m = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner, isWritable });
const canon = (o) => "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + JSON.stringify(o[k])).join(",") + "}";
const registrationOf = (gene, group, axis) => createHash("sha256").update(canon({ axis, cohort: COHORT, gene, group, protocol: 2 })).digest("hex");

const seed = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(kp.secretKey.subarray(0, 32))]), format: "der", type: "pkcs8" });
const proof = (action, extra = {}) =>
  [`james ${action}`, `wallet: ${wallet}`, ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`), `day: ${new Date().toISOString().slice(0, 10)}`].join("\n");
const signMessage = (msg) => bs58.encode(sign(null, Buffer.from(msg, "utf8"), seed));

async function api(p, body) {
  const r = await fetch(BASE + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

async function send(ixs) {
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: kp.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
  tx.sign([kp]);
  const sig = await c.sendTransaction(tx, { maxRetries: 3 });
  const res = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error("transaction failed: " + JSON.stringify(res.value.err));
  return sig;
}

/** what one transaction took from the wallet: the fee plus any rent it paid, in lamports */
async function costOf(sig) {
  for (let i = 0; i < 20; i++) {
    const t = await c.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (t?.meta) {
      const keys = t.transaction.message.staticAccountKeys ?? t.transaction.message.accountKeys;
      const at = keys.findIndex((k) => k.toBase58() === wallet);
      return { fee: t.meta.fee, total: at < 0 ? 0 : t.meta.preBalances[at] - t.meta.postBalances[at] };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

const tokens = async () => (await c.getTokenAccountBalance(ata).catch(() => null))?.value.uiAmount ?? 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
let failures = 0;
async function step(name, fn) {
  try {
    const out = await fn();
    const sigs = [out?.sigs ?? []].flat().filter(Boolean);
    let fee = 0, total = 0;
    for (const s of [...new Set(sigs)]) { const k = await costOf(s); if (k) { fee += k.fee; total += k.total; } }
    rows.push({ name, ok: true, fee, total, note: out?.note ?? "", sigs });
    console.log(`  ok    ${name}${out?.note ? `: ${out.note}` : ""}`);
  } catch (e) {
    failures++;
    rows.push({ name, ok: false, fee: 0, total: 0, note: e.message, sigs: [] });
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------------------------------------------------------------- the run
console.log(`server ${BASE}\nwallet ${wallet}\nrpc    ${RPC}\n`);
const startSol = await c.getBalance(kp.publicKey);

await step("server runs the registry program with this wallet as its agent", async () => {
  const s = await api("/api/chain");
  need(s.mode === "program", `chain mode is ${s.mode}`);
  need(s.agent === wallet, `the server's agent is ${s.agent}`);
  return { note: `registry ${s.registry}, ${s.state?.predictions ?? 0} predictions on-chain` };
});

await step("faucet mints test tokens to the wallet", async () => {
  const before = await tokens();
  const r = await api("/api/chain/faucet", { wallet, signature: signMessage(proof("faucet")) });
  if (r.status === 429) return { note: `skipped (${r.error}); balance ${before}` };
  need(r.tx, r.error ?? "no transaction");
  const after = await tokens();
  return { sigs: r.tx, note: `${before} → ${after} tJAMES` };
});

await step("a holder puts a gene at the front of the queue", async () => {
  const gene = "GPNMB";
  const r = await api("/api/queue", { gene, wallet, signature: signMessage(proof("queue", { gene })) });
  need(r.gene, r.error ?? "not queued");
  return { note: `${r.gene} at position ${r.position} (wallet holds ${r.balance})` };
});

let held = null;
await step("wallet prediction: prepared by the server, signed by the wallet, registered, tested, resolved", async () => {
  for (const p of HOLDS) {
    const prep = await api("/api/predict/prepare", { ...p, by: "e2e", wallet });
    if (prep.repeat) continue;
    need(prep.tx, prep.error ?? "no transaction to sign");
    const tx = VersionedTransaction.deserialize(Buffer.from(prep.tx, "base64"));
    tx.sign([kp]);
    const r = await api("/api/predict/submit", { registration: prep.registration, tx: Buffer.from(tx.serialize()).toString("base64") });
    need(r.registration, r.error ?? "submit failed");
    need(r.chain_status === "resolved" || r.chain_status === "rewarded", `chain status ${r.chain_status}`);
    held = r;
    return { sigs: [r.chain_tx, r.resolve_tx], note: `${r.gene} ${r.axis}: ${r.passed ? "held" : "failed"}, ${r.chain_status}` };
  }
  throw new Error("every candidate was registered before; add new ones to HOLDS");
});

await step("the predictor of a replicated prediction is rewarded (one wallet: sent directly, the server skips self-rewards)", async () => {
  need(held?.passed, "the wallet prediction did not replicate, so there is nothing to reward");
  const hash = Buffer.from(held.registration, "hex");
  const before = await tokens();
  const sig = await send([new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      m(registry, false, false), m(pda(Buffer.from("prediction"), hash), false, true), m(mint, false, true), m(kp.publicKey, false, false),
      m(ata, false, true), m(kp.publicKey, true, true), m(TOKEN_PROGRAM_ID, false, false), m(ATA_PROGRAM_ID, false, false), m(SystemProgram.programId, false, false),
    ],
    data: disc("reward_predictor"),
  })]);
  return { sigs: sig, note: `${before} → ${await tokens()} tJAMES` };
});

await step("a prediction registered straight on the program is picked up and tested by the server", async () => {
  const p = { gene: "GPNMB", group: "microglia", axis: "braak" };
  const reg = registrationOf(p.gene, p.group, p.axis);
  const known = (await api(`/api/chain/wallet/${wallet}`)).predictions?.find((x) => x.registration === reg);
  let sig = null;
  if (!known) {
    const gene = Buffer.alloc(16); gene.write(p.gene, "ascii");
    sig = await send([new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [m(registry, false, true), m(pda(Buffer.from("prediction"), Buffer.from(reg, "hex")), false, true), m(kp.publicKey, true, false), m(kp.publicKey, true, true), m(SystemProgram.programId, false, false)],
      data: Buffer.concat([disc("register_prediction"), Buffer.from(reg, "hex"), gene, Buffer.from([GROUPS.indexOf(p.group), AXES.indexOf(p.axis)])]),
    })]);
  }
  // the server sweeps the program every five minutes
  for (let i = 0; i < 48; i++) {
    const x = (await api(`/api/chain/wallet/${wallet}`)).predictions?.find((e) => e.registration === reg);
    if (x?.resolve_tx) return { sigs: [sig, x.resolve_tx], note: `${x.gene} ${x.group} ${x.axis}: ${x.passed ? "held" : "failed"}, ${x.chain_status} after ${i * 10}s` };
    await wait(10_000);
  }
  throw new Error("not picked up within 8 minutes");
});

await step("the agent seals its own two predictions per gene in one memo transaction", async () => {
  const r = await api("/api/experiments?limit=40");
  const mine = (r.results ?? []).filter((e) => e.source === "agent" && e.chain_tx);
  need(mine.length, "no agent predictions sealed on-chain yet");
  const byTx = new Map();
  for (const e of mine) byTx.set(e.chain_tx, [...(byTx.get(e.chain_tx) ?? []), e]);
  const pair = [...byTx.values()].find((v) => v.length >= 2);
  need(pair, "no transaction carries two seals yet");
  return { sigs: [pair[0].chain_tx, pair[0].resolve_tx], note: `${pair[0].gene}: ${pair.length} seals in ${pair[0].chain_tx.slice(0, 12)}…, results in ${pair[0].resolve_tx?.slice(0, 12) ?? "pending"}…` };
});

await step("the receipt chain head is checkpointed in the registry", async () => {
  for (let i = 0; i < 40; i++) {
    const s = await api("/api/chain");
    if (s.anchors?.length && s.state?.receiptHeadNo > 0) return { sigs: s.anchors[0].tx, note: `head ${s.state.receiptHeadNo} (${s.state.receiptHeadHash.slice(0, 12)}…)` };
    await wait(15_000);
  }
  throw new Error("no checkpoint within 10 minutes");
});

// ---------------------------------------------------------------- the bill
const SOL = (l) => (l / 1e9).toFixed(6);
console.log("\nstep".padEnd(100) + "fee SOL".padStart(11) + "total SOL".padStart(12));
for (const r of rows) console.log(`${r.ok ? "  " : "x "}${r.name}`.slice(0, 99).padEnd(99) + SOL(r.fee).padStart(11) + SOL(r.total).padStart(12));
const sum = rows.reduce((a, r) => a + r.total, 0);
console.log("".padEnd(99) + "".padStart(11) + SOL(sum).padStart(12));
console.log(`\nwallet ${SOL(startSol)} → ${SOL(await c.getBalance(kp.publicKey))} SOL (includes the agent's own memos while this ran)`);
console.log(`${rows.length - failures} of ${rows.length} steps passed`);
process.exit(failures ? 1 : 0);
