// The agent's side of the chain. Its own predictions (and anonymous visitors') are sealed before the data is read: as
// events of the registry contract, many hashes in one transaction, or before the contract is deployed as memo data in a
// transaction to itself. Wallet predictions are stored in the contract: the wallet signs (EIP-712), the agent registers
// it and pays the gas, so the predictor, the result and the reward live on-chain. Every record keeps the chain id it
// was written to, so moving from the testnet to mainnet never mixes the two.
import {
  createPublicClient, createWalletClient, erc20Abi, fallback, formatEther, formatUnits, http, stringToHex, verifyTypedData,
  type Account, type Address, type Chain, type Hex, type PublicClient, type Transport, type WalletClient,
} from "viem";
import { receiptHead } from "@/lib/agent/receipts";
import { AXES, cohorts, GROUPS, isAxis, isGroup } from "@/lib/atlas/cohort";
import { getExperiment, registrationOf, seal, test, type Experiment } from "@/lib/atlas/experiments";
import { BRAND } from "@/lib/brand";
import { all, kvGet, kvSet, nowIso, one, run } from "@/lib/server/db";
import { registryAbi } from "./abi";
import { BACKUP_RPC, CHAIN, GATE_TOKEN, NETWORK, PUBLIC_RPC, REGISTRY, registerTypedData, TOKEN_SYMBOL } from "./config";
import { agentAccount } from "./keys";

export type Mode = "contract" | "memo" | "off";
const NONE = 0, PENDING = 1;
const HERE = String(CHAIN.id);

const g = globalThis as unknown as {
  __parkinsonPublic?: PublicClient<Transport, Chain>; __parkinsonWallet?: WalletClient<Transport, Chain, Account>; __parkinsonMode?: { at: number; mode: Mode };
};
// the server may use a keyed endpoint (RPC_URL, e.g. Alchemy); browsers only ever see the public one. A second public
// endpoint takes over when the first fails, rate-limits, or is blocked where the server runs.
const transport = () =>
  fallback([...new Set([process.env.RPC_URL || PUBLIC_RPC, BACKUP_RPC[CHAIN.id]].filter(Boolean))].map((url) => http(url, { batch: true, retryCount: 1, timeout: 15_000 })));
export const publicClient = () => (g.__parkinsonPublic ??= createPublicClient({ chain: CHAIN, transport: transport() }));
const wallet = () => (g.__parkinsonWallet ??= createWalletClient({ account: agentAccount()!, chain: CHAIN, transport: transport() }));
const short = (e: unknown) => ((e as { shortMessage?: string })?.shortMessage ?? (e instanceof Error ? e.message : String(e))).replace(/\s+/g, " ").slice(0, 160);

export async function chainMode(): Promise<Mode> {
  if (process.env.CHAIN_ENABLED === "false" || !agentAccount()) return "off";
  const hit = g.__parkinsonMode;
  if (hit && Date.now() - hit.at < 60_000) return hit.mode;
  let mode: Mode = hit?.mode ?? "memo";
  try {
    const code = REGISTRY ? await publicClient().getCode({ address: REGISTRY }) : undefined;
    mode = code && code !== "0x" ? "contract" : "memo";
  } catch {
    /* keep the last known mode while the RPC is down */
  }
  g.__parkinsonMode = { at: Date.now(), mode };
  return mode;
}

/** waits for the transaction and fails loudly if it reverted */
async function confirm(hash: Hex): Promise<Hex> {
  const r = await publicClient().waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (r.status !== "success") throw new Error(`transaction reverted: ${hash}`);
  return hash;
}

const registry = () => ({ address: REGISTRY!, abi: registryAbi, chain: CHAIN, account: agentAccount()! });
const memo = async (lines: string[]) => {
  const account = agentAccount()!;
  return confirm(await wallet().sendTransaction({ account, chain: CHAIN, to: account.address, data: stringToHex(lines.join("\n")) }));
};
const bytes32 = (registration: string) => `0x${registration}` as Hex;
/** effects go on-chain as int16, times 10,000 */
const i16 = (x: number | undefined) => Math.max(-32768, Math.min(32767, Math.round((x ?? 0) * 10000)));
const mine = (x: Experiment) => x.chain == null || x.chain === HERE;

// ---------------------------------------------------------------- the agent's and anonymous predictions
// Predictions sealed together share one transaction, so a gene's predictions cost one transaction to seal and one to
// resolve, however many there are.
export async function sealOnChain(exps: Experiment | Experiment[]): Promise<void> {
  const todo = [exps].flat().filter((e) => !e.chain_tx);
  const mode = await chainMode();
  if (!todo.length || mode === "off") return;
  try {
    const tx = mode === "contract"
      ? await confirm(await wallet().writeContract({ ...registry(), functionName: "seal", args: [todo.map((e) => bytes32(e.registration))] }))
      : await memo(todo.map((e) => `${BRAND.name}:seal:v${e.protocol}:${e.registration}`));
    for (const e of todo) run("update experiments set chain_tx = ?, chain_status = ?, chain = ? where registration = ?", tx, mode === "contract" ? "sealed" : "memo-sealed", HERE, e.registration);
  } catch (err) {
    for (const e of todo) run("update experiments set chain_status = ? where registration = ?", "seal-failed: " + short(err), e.registration);
  }
}

export async function resolveOnChain(exps: Experiment | Experiment[]): Promise<void> {
  const mode = await chainMode();
  if (mode === "off") return;
  const ready = [exps].flat().map((e) => getExperiment(e.registration)).filter((x): x is Experiment => !!x?.chain_tx && !x.resolve_tx && x.state === "tested" && mine(x));
  const events: Experiment[] = [];
  for (const x of ready) {
    if (stored(x) && mode === "contract") await resolveStored(x);
    else events.push(x);
  }
  if (!events.length) return;
  const line = (x: Experiment) =>
    `${BRAND.name}:result:${x.registration}:${x.passed ? 1 : 0}:${(x.discovery?.effect ?? 0).toFixed(3)}:${(x.replication?.effect ?? 0).toFixed(3)}:${x.receipt ?? 0}`;
  try {
    const tx = mode === "contract"
      ? await confirm(await wallet().writeContract({
          ...registry(), functionName: "publish",
          args: [events.map((x) => ({ hash: bytes32(x.registration), passed: !!x.passed, effectDiscovery: i16(x.discovery?.effect), effectReplication: i16(x.replication?.effect), receiptNo: x.receipt ?? 0 }))],
        }))
      : await memo(events.map(line));
    for (const x of events) run("update experiments set resolve_tx = ?, chain_status = ? where registration = ?", tx, mode === "contract" ? "resolved" : "memo-resolved", x.registration);
  } catch (err) {
    for (const x of events) run("update experiments set chain_status = ? where registration = ?", "resolve-failed: " + short(err), x.registration);
  }
}

/** wallet predictions (signed on the site, or registered straight on the contract) are stored in it */
const stored = (x: Experiment) => x.source === "wallet" || x.source === "onchain";

async function resolveStored(x: Experiment): Promise<void> {
  const agent = agentAccount()!;
  const hash = bytes32(x.registration);
  let rewarded = false;
  try {
    // a result (or reward) that went through while the last attempt timed out is not written twice
    const before = await publicClient().readContract({ address: REGISTRY!, abi: registryAbi, functionName: "prediction", args: [hash] });
    rewarded = before.rewarded;
    // a node a block or two behind does not know the registration yet: retried on the next chores, never taken as resolved
    if (before.status === NONE) throw new Error("the RPC node has not seen this registration yet");
    const tx = before.status === PENDING
      ? await confirm(await wallet().writeContract({ ...registry(), functionName: "resolve", args: [hash, !!x.passed, i16(x.discovery?.effect), i16(x.replication?.effect), x.receipt ?? 0] }))
      : "on-chain";
    run("update experiments set resolve_tx = ?, chain_status = 'resolved' where registration = ?", tx, x.registration);
  } catch (err) {
    run("update experiments set chain_status = ? where registration = ?", "resolve-failed: " + short(err), x.registration);
    return;
  }
  // the agent does not pay itself, and rewards stay off until the owner configures a token and an amount
  if (!x.passed || rewarded || !x.wallet || x.wallet.toLowerCase() === agent.address.toLowerCase() || !(await rewardsOn())) return;
  try {
    const r = await confirm(await wallet().writeContract({ ...registry(), functionName: "reward", args: [hash] }));
    run("update experiments set reward_tx = ?, chain_status = 'rewarded' where registration = ?", r, x.registration);
  } catch (err) {
    run("update experiments set chain_status = ? where registration = ?", "reward-failed: " + short(err), x.registration);
  }
}

async function rewardsOn(): Promise<boolean> {
  const s = await registryState();
  return !!s && s.token !== ZERO && s.rewardAmount > 0n && s.pool >= s.rewardAmount;
}

/** results that did not go through (an RPC hiccup, an empty gas balance) are tried again on the next chores */
export async function retryResults(): Promise<number> {
  if ((await chainMode()) === "off") return 0;
  const failed = all<{ registration: string }>(
    "select registration from experiments where state = 'tested' and resolve_tx is null and chain_tx is not null and chain_status like 'resolve-failed%' and (chain is null or chain = ?) order by at limit 20", HERE,
  );
  for (const f of failed) await resolveOnChain(getExperiment(f.registration)!);
  return failed.length;
}

// ---------------------------------------------------------------- wallet predictions (stored, the agent pays)
type Draft = { gene: string; group: string; axis: string; by?: string | null; wallet: Address };

// The agent pays every wallet prediction's gas, and new wallets cost nothing, so on mainnet the number it pays for in a day
// is capped: WALLET_PREDICTIONS_PER_DAY (default 30 on mainnet; 0 = no cap, the default elsewhere)
const WALLET_DAILY = Number(process.env.WALLET_PREDICTIONS_PER_DAY ?? (NETWORK === "mainnet" ? 30 : 0));
function checkWalletQuota() {
  if (!WALLET_DAILY) return;
  const since = new Date(Date.now() - 864e5).toISOString().replace(/\.\d{3}Z$/, "Z");
  const n = one<{ n: number }>("select count(*) as n from experiments where source = 'wallet' and chain = ? and at >= ?", HERE, since)?.n ?? 0;
  if (n >= WALLET_DAILY) throw new Error(`the agent pays the gas for ${WALLET_DAILY} wallet predictions a day, and today's are taken; try again later`);
}

export async function prepareWalletSeal(d: Draft) {
  if ((await chainMode()) !== "contract") throw new Error("wallet predictions need the registry contract, which is not live on this network yet");
  if (!isGroup(d.group) || !isAxis(d.axis)) throw new Error("unknown cell group or outcome");
  const registration = registrationOf(d.gene, d.group, d.axis, cohorts().primary.id);
  const existing = getExperiment(registration);
  if (existing) return { repeat: true as const, registration, exp: existing };
  checkWalletQuota();
  const onChain = await publicClient().readContract({ address: REGISTRY!, abi: registryAbi, functionName: "prediction", args: [bytes32(registration)] });
  if (onChain.status !== 0) throw new Error("this prediction is already registered on-chain; it is picked up and tested within a few minutes");
  const typed = registerTypedData(registration, d.gene, GROUPS.indexOf(d.group), AXES.indexOf(d.axis));
  run(
    "insert into pending_tx (registration, wallet, message, by, gene, grp, axis, at) values (?, ?, ?, ?, ?, ?, ?, ?) on conflict(registration) do update set wallet = excluded.wallet, message = excluded.message, by = excluded.by, at = excluded.at",
    registration, d.wallet, JSON.stringify(typed.domain), d.by ?? null, d.gene, d.group, d.axis, nowIso(),
  );
  return { repeat: false as const, registration, typed };
}

export async function submitWalletSeal(registration: string, signature: string): Promise<Experiment> {
  const p = one<{ wallet: Address; message: string; by: string | null; gene: string; grp: string; axis: string }>("select * from pending_tx where registration = ?", registration);
  if (!agentAccount() || !p) throw new Error("no prepared prediction for this registration; start again");
  if (!isGroup(p.grp) || !isAxis(p.axis)) throw new Error("bad prediction");
  if (!/^0x[0-9a-fA-F]{130,}$/.test(signature)) throw new Error("that is not a signature");
  const typed = registerTypedData(registration, p.gene, GROUPS.indexOf(p.grp), AXES.indexOf(p.axis));
  if (JSON.stringify(typed.domain) !== p.message) throw new Error("the registry changed since this was prepared; start again");
  const sig = signature as Hex;
  // checked here first so a bad signature costs no gas; contract wallets (EIP-1271) are checked through the chain
  const valid = (await verifyTypedData({ ...typed, address: p.wallet, signature: sig }).catch(() => false))
    || (await publicClient().verifyTypedData({ ...typed, address: p.wallet, signature: sig }).catch(() => false));
  if (!valid) throw new Error("the signature does not match this wallet and prediction");
  checkWalletQuota();
  const tx = await confirm(await wallet().writeContract({
    ...registry(), functionName: "registerFor",
    args: [bytes32(registration), p.gene, GROUPS.indexOf(p.grp), AXES.indexOf(p.axis), p.wallet, sig],
  }));
  run("delete from pending_tx where registration = ?", registration);
  const { exp } = seal({ gene: p.gene, group: p.grp, axis: p.axis, by: p.by, wallet: p.wallet, source: "wallet" });
  run("update experiments set chain_tx = ?, chain_status = 'registered', chain = ? where registration = ?", tx, HERE, exp.registration);
  await resolveOnChain(test(exp.registration));
  return getExperiment(exp.registration)!;
}

/** predictions registered straight on the contract, by any client, get picked up and tested too. The contract keeps
 *  them in order, so the sweep reads pages from where it stopped instead of querying logs. */
export async function syncOnchainPredictions(): Promise<number> {
  if ((await chainMode()) !== "contract") return 0;
  const c = publicClient();
  const key = `sync:${HERE}:${REGISTRY!.toLowerCase()}`;
  const total = Number(await c.readContract({ address: REGISTRY!, abi: registryAbi, functionName: "count" }));
  let from = kvGet<number>(key, 0), n = 0;
  while (from < total) {
    const [hashes, preds] = await c.readContract({ address: REGISTRY!, abi: registryAbi, functionName: "page", args: [BigInt(from), 50n] });
    for (let i = 0; i < hashes.length; i++) {
      const p = preds[i], hash = hashes[i].slice(2);
      // a hash already in the ledger was sealed here first; a late copy on-chain earns nothing
      if (p.status !== PENDING || getExperiment(hash)) continue;
      const gene = Buffer.from(p.gene.slice(2), "hex").toString("ascii").replace(/\0+$/, "");
      const group = GROUPS[p.group], axis = AXES[p.axis];
      if (!group || !axis || registrationOf(gene, group, axis, cohorts().primary.id) !== hash) continue;
      const { exp } = seal({ gene, group, axis, wallet: p.predictor, source: "onchain" });
      run("update experiments set chain_tx = ?, chain_status = 'registered', chain = ? where registration = ?", `registry:${from + i}`, HERE, exp.registration);
      await resolveOnChain(test(exp.registration));
      n++;
    }
    from += hashes.length;
    kvSet(key, from);
  }
  return n;
}

// ---------------------------------------------------------------- receipts checkpoint, faucet, reads
export async function anchorReceipts(force = false): Promise<string | null> {
  const mode = await chainMode();
  const head = receiptHead();
  if (mode === "off" || !head) return null;
  const key = `anchor_last:${HERE}:${mode === "contract" ? REGISTRY!.toLowerCase() : "memo"}`;
  const last = kvGet<{ no: number; at: number }>(key, { no: 0, at: 0 });
  if (head.no <= last.no || (!force && head.no - last.no < 25 && Date.now() - last.at < 3600_000)) return null;
  if (mode === "contract") {
    // the contract only takes heads past its own; one ahead of this ledger means the ledger was replaced or rolled back
    const s = await registryState();
    if (s && BigInt(head.no) <= s.receiptHeadNo) {
      console.warn(`[parkinson] anchor: the registry already holds receipt ${s.receiptHeadNo}, past this ledger's head ${head.no}`);
      return null;
    }
  }
  const tx = mode === "contract"
    ? await confirm(await wallet().writeContract({ ...registry(), functionName: "anchor", args: [BigInt(head.no), bytes32(head.hash)] }))
    : await memo([`${BRAND.name}:receipts:${head.no}:${head.hash}`]);
  run("insert into anchors (at, head_no, head_hash, tx, chain) values (?, ?, ?, ?, ?)", nowIso(), head.no, head.hash, tx, HERE);
  kvSet(key, { no: head.no, at: Date.now() });
  return tx;
}

export async function faucet(to: Address): Promise<string> {
  if ((await chainMode()) !== "contract") throw new Error("the faucet needs the registry contract, which is not live yet");
  const s = await registryState();
  if (!s || s.token === ZERO || s.faucetAmount === 0n) throw new Error("the faucet is off on this network");
  return confirm(await wallet().writeContract({ ...registry(), functionName: "drip", args: [to] }));
}

const decimals = new Map<string, number>();
/** whole tokens of the gate token a wallet holds */
export async function tokenBalance(owner: Address): Promise<number> {
  if (!GATE_TOKEN) return 0;
  try {
    const c = publicClient();
    if (!decimals.has(GATE_TOKEN)) decimals.set(GATE_TOKEN, await c.readContract({ address: GATE_TOKEN, abi: erc20Abi, functionName: "decimals" }));
    const raw = await c.readContract({ address: GATE_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
    return Number(formatUnits(raw, decimals.get(GATE_TOKEN)!));
  } catch {
    return 0;
  }
}

const ZERO = "0x0000000000000000000000000000000000000000";
async function registryState() {
  if (!REGISTRY) return null;
  return publicClient().readContract({ address: REGISTRY, abi: registryAbi, functionName: "state" }).catch(() => null);
}

export async function chainStatus() {
  const mode = await chainMode();
  const agent = agentAccount();
  const c = publicClient();
  const [s, gas] = await Promise.all([
    mode === "contract" ? registryState() : null,
    agent ? c.getBalance({ address: agent.address }).catch(() => null) : null,
  ]);
  const tokens = (x: bigint) => Number(formatEther(x));
  return {
    mode,
    network: NETWORK,
    chain: { id: CHAIN.id, name: CHAIN.name },
    registry: REGISTRY,
    agent: agent?.address ?? null,
    agentEth: gas == null ? null : Number(formatEther(gas)),
    gate: { token: GATE_TOKEN, symbol: TOKEN_SYMBOL },
    state: s && {
      owner: s.owner, oracle: s.oracle, token: s.token === ZERO ? null : s.token,
      predictions: Number(s.predictions), resolved: Number(s.resolved), replicated: Number(s.replicated),
      receiptHeadNo: Number(s.receiptHeadNo), receiptHeadHash: s.receiptHeadHash.slice(2), anchoredAt: Number(s.anchoredAt),
      // the test token has 18 decimals; on mainnet the owner sets the token (and its amounts) by hand
      rewardAmount: tokens(s.rewardAmount), faucetAmount: tokens(s.faucetAmount), pool: tokens(s.pool),
    },
    anchors: all<{ at: string; head_no: number; head_hash: string; tx: string; chain: string | null }>("select at, head_no, head_hash, tx, chain from anchors order by id desc limit 10"),
  };
}
