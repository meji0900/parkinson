// The agent's side of the chain. Its own predictions (and anonymous visitors') are sealed with a memo
// before the data is read: cheap, and the block time is the proof. Wallet predictions get their own
// program account, sponsored by the agent, so the predictor, the result and the reward live on-chain.
import {
  Connection, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction, type Keypair,
} from "@solana/web3.js";
import bs58 from "bs58";
import { receiptHead } from "@/lib/agent/receipts";
import { AXES, cohorts, GROUPS, isAxis, isGroup } from "@/lib/atlas/cohort";
import { getExperiment, registrationOf, seal, test, type Experiment } from "@/lib/atlas/experiments";
import { all, kvGet, kvSet, nowIso, one, run } from "@/lib/server/db";
import { MEMO_PROGRAM_ID, PROGRAM_ID, PUBLIC_RPC, TOKEN_DECIMALS, ataOf, mintPda, registryPda } from "./config";
import { agentKeypair } from "./keys";
import { anchorIx, decodePrediction, decodeRegistry, faucetIx, PREDICTION_DISC, registerIx, resolveIx, rewardIx } from "./program";

export type Mode = "program" | "memo" | "off";

const g = globalThis as unknown as { __jamesConn?: Connection; __jamesMode?: { at: number; mode: Mode } };
export const connection = () => (g.__jamesConn ??= new Connection(process.env.SOLANA_RPC_URL ?? PUBLIC_RPC, "confirmed"));
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 160);

export async function chainMode(): Promise<Mode> {
  if (process.env.CHAIN_ENABLED === "false" || !agentKeypair()) return "off";
  const hit = g.__jamesMode;
  if (hit && Date.now() - hit.at < 60_000) return hit.mode;
  let mode: Mode = hit?.mode ?? "memo";
  try {
    const info = await connection().getAccountInfo(registryPda());
    mode = info && info.owner.equals(PROGRAM_ID) ? "program" : "memo";
  } catch {
    /* keep the last known mode while the RPC is down */
  }
  g.__jamesMode = { at: Date.now(), mode };
  return mode;
}

export async function send(ixs: TransactionInstruction[], signers: Keypair[]): Promise<string> {
  const c = connection();
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({ payerKey: signers[0].publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign(signers);
  const sig = await c.sendTransaction(tx, { maxRetries: 3 });
  const res = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error("transaction failed: " + JSON.stringify(res.value.err));
  return sig;
}

const memo = (text: string) => new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(text, "utf8") });

// ---------------------------------------------------------------- agent and anonymous predictions (memo)
// Predictions sealed together share a transaction, one memo each: the fee is per signature, so a gene's two
// predictions cost one fee to seal and one to resolve.
export async function sealOnChain(exps: Experiment | Experiment[]): Promise<void> {
  const agent = agentKeypair();
  const todo = [exps].flat().filter((e) => !e.chain_tx);
  if (!todo.length || (await chainMode()) === "off" || !agent) return;
  try {
    const sig = await send(todo.map((e) => memo(`james:seal:v${e.protocol}:${e.registration}`)), [agent]);
    for (const e of todo) run("update experiments set chain_tx = ?, chain_status = 'memo-sealed' where registration = ?", sig, e.registration);
  } catch (err) {
    for (const e of todo) run("update experiments set chain_status = ? where registration = ?", "seal-failed: " + short(err), e.registration);
  }
}

export async function resolveOnChain(exps: Experiment | Experiment[]): Promise<void> {
  const agent = agentKeypair();
  const mode = await chainMode();
  if (mode === "off" || !agent) return;
  const ready = [exps].flat().map((e) => getExperiment(e.registration)).filter((x): x is Experiment => !!x?.chain_tx && !x.resolve_tx && x.state === "tested");
  const memos: Experiment[] = [];
  for (const x of ready) {
    if (x.chain_status === "sealed" && mode === "program") await resolveAccount(x, agent);
    else memos.push(x);
  }
  if (!memos.length) return;
  const line = (x: Experiment) =>
    `james:result:${x.registration}:${x.passed ? 1 : 0}:${(x.discovery?.effect ?? 0).toFixed(3)}:${(x.replication?.effect ?? 0).toFixed(3)}:${x.receipt ?? 0}`;
  try {
    const sig = await send(memos.map((x) => memo(line(x))), [agent]);
    for (const x of memos) run("update experiments set resolve_tx = ?, chain_status = 'memo-resolved' where registration = ?", sig, x.registration);
  } catch (err) {
    for (const x of memos) run("update experiments set chain_status = ? where registration = ?", "resolve-failed: " + short(err), x.registration);
  }
}

/** a wallet prediction lives in its own program account: the result is written there, and a replicated one is rewarded */
async function resolveAccount(x: Experiment, agent: Keypair): Promise<void> {
  const hash = Buffer.from(x.registration, "hex");
  try {
    const sig = await send([resolveIx(hash, !!x.passed, x.discovery?.effect ?? 0, x.replication?.effect ?? 0, x.receipt ?? 0, agent.publicKey)], [agent]);
    run("update experiments set resolve_tx = ?, chain_status = 'resolved' where registration = ?", sig, x.registration);
    if (x.passed && x.wallet && x.wallet !== agent.publicKey.toBase58()) {
      const r = await send([rewardIx(hash, new PublicKey(x.wallet), agent.publicKey)], [agent]);
      run("update experiments set reward_tx = ?, chain_status = 'rewarded' where registration = ?", r, x.registration);
    }
  } catch (err) {
    run("update experiments set chain_status = ? where registration = ?", "resolve-failed: " + short(err), x.registration);
  }
}

// ---------------------------------------------------------------- wallet predictions (program accounts, sponsored)
type Draft = { gene: string; group: string; axis: string; by?: string | null; wallet: string };

export async function prepareWalletSeal(d: Draft) {
  const agent = agentKeypair();
  if ((await chainMode()) !== "program" || !agent) throw new Error("wallet predictions need the registry program, which is not live on this cluster yet");
  if (!isGroup(d.group) || !isAxis(d.axis)) throw new Error("unknown cell group or outcome");
  const registration = registrationOf(d.gene, d.group, d.axis, cohorts().primary.id);
  const existing = getExperiment(registration);
  if (existing) return { repeat: true as const, registration, exp: existing };
  const hash = Buffer.from(registration, "hex");
  const { blockhash } = await connection().getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: agent.publicKey, recentBlockhash: blockhash,
    instructions: [registerIx(hash, d.gene, GROUPS.indexOf(d.group), AXES.indexOf(d.axis), new PublicKey(d.wallet), agent.publicKey)],
  }).compileToV0Message();
  const message = Buffer.from(msg.serialize()).toString("base64");
  run(
    "insert into pending_tx (registration, wallet, message, by, gene, grp, axis, at) values (?, ?, ?, ?, ?, ?, ?, ?) on conflict(registration) do update set wallet = excluded.wallet, message = excluded.message, by = excluded.by, at = excluded.at",
    registration, d.wallet, message, d.by ?? null, d.gene, d.group, d.axis, nowIso(),
  );
  return { repeat: false as const, registration, tx: Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64") };
}

export async function submitWalletSeal(registration: string, signedB64: string): Promise<Experiment> {
  const agent = agentKeypair();
  const p = one<{ wallet: string; message: string; by: string | null; gene: string; grp: string; axis: string }>("select * from pending_tx where registration = ?", registration);
  if (!agent || !p) throw new Error("no prepared transaction for this prediction; start again");
  const tx = VersionedTransaction.deserialize(Buffer.from(signedB64, "base64"));
  if (Buffer.from(tx.message.serialize()).toString("base64") !== p.message) throw new Error("the signed transaction is not the one that was prepared");
  const signerIdx = tx.message.staticAccountKeys.findIndex((k) => k.toBase58() === p.wallet);
  if (signerIdx < 0 || signerIdx >= tx.message.header.numRequiredSignatures || tx.signatures[signerIdx].every((b) => b === 0)) {
    throw new Error("the wallet did not sign");
  }
  tx.sign([agent]);
  const c = connection();
  const sig = await c.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const res = await c.confirmTransaction({ signature: sig, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: (await c.getBlockHeight()) + 150 }, "confirmed");
  if (res.value.err) throw new Error("registration failed on-chain: " + JSON.stringify(res.value.err));
  run("delete from pending_tx where registration = ?", registration);
  if (!isGroup(p.grp) || !isAxis(p.axis)) throw new Error("bad prediction");
  const { exp } = seal({ gene: p.gene, group: p.grp, axis: p.axis, by: p.by, wallet: p.wallet, source: "wallet" });
  run("update experiments set chain_tx = ?, chain_status = 'sealed' where registration = ?", sig, exp.registration);
  const tested = test(exp.registration);
  await resolveOnChain(tested);
  return getExperiment(exp.registration)!;
}

/** predictions registered straight against the program, by any client, get picked up and tested too */
export async function syncOnchainPredictions(): Promise<number> {
  if ((await chainMode()) !== "program") return 0;
  const accounts = await connection().getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(PREDICTION_DISC()) } }],
  });
  let n = 0;
  for (const a of accounts) {
    const p = decodePrediction(a.account.data as Buffer);
    if (!p || p.status !== "pending" || getExperiment(p.hash)) continue;
    const group = GROUPS[p.group], axis = AXES[p.axis];
    if (!group || !axis || registrationOf(p.gene, group, axis, cohorts().primary.id) !== p.hash) continue;
    const { exp } = seal({ gene: p.gene, group, axis, wallet: p.predictor, source: "onchain" });
    run("update experiments set chain_tx = ?, chain_status = 'sealed' where registration = ?", "account:" + a.pubkey.toBase58(), exp.registration);
    await resolveOnChain(test(exp.registration));
    n++;
  }
  return n;
}


// ---------------------------------------------------------------- receipts checkpoint, faucet, reads
export async function anchorReceipts(force = false): Promise<string | null> {
  const agent = agentKeypair();
  const mode = await chainMode();
  const head = receiptHead();
  if (mode === "off" || !agent || !head) return null;
  const last = kvGet<{ no: number; at: number }>("anchor_last", { no: 0, at: 0 });
  if (head.no <= last.no || (!force && head.no - last.no < 25 && Date.now() - last.at < 3600_000)) return null;
  const sig = mode === "program"
    ? await send([anchorIx(head.no, Buffer.from(head.hash, "hex"), agent.publicKey)], [agent])
    : await send([memo(`james:receipts:${head.no}:${head.hash}`)], [agent]);
  run("insert into anchors (at, head_no, head_hash, tx) values (?, ?, ?, ?)", nowIso(), head.no, head.hash, sig);
  kvSet("anchor_last", { no: head.no, at: Date.now() });
  return sig;
}

export async function faucet(wallet: string): Promise<string> {
  const agent = agentKeypair();
  if ((await chainMode()) !== "program" || !agent) throw new Error("the faucet needs the registry program, which is not live yet");
  return send([faucetIx(new PublicKey(wallet), agent.publicKey)], [agent]);
}

export async function tokenBalance(wallet: string): Promise<number> {
  try {
    const r = await connection().getTokenAccountBalance(ataOf(new PublicKey(wallet), mintPda()));
    return r.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

export async function chainStatus() {
  const mode = await chainMode();
  const agent = agentKeypair();
  const c = connection();
  const [reg, bal, supply] = await Promise.all([
    c.getAccountInfo(registryPda()).catch(() => null),
    agent ? c.getBalance(agent.publicKey).catch(() => null) : null,
    c.getTokenSupply(mintPda()).catch(() => null),
  ]);
  return {
    mode,
    program: PROGRAM_ID.toBase58(),
    registry: registryPda().toBase58(),
    mint: mintPda().toBase58(),
    decimals: TOKEN_DECIMALS,
    agent: agent?.publicKey.toBase58() ?? null,
    agentSol: bal == null ? null : bal / 1e9,
    state: reg ? decodeRegistry(reg.data as Buffer) : null,
    supply: supply?.value.uiAmount ?? 0,
    anchors: all<{ at: string; head_no: number; head_hash: string; tx: string }>("select at, head_no, head_hash, tx from anchors order by id desc limit 10"),
  };
}
