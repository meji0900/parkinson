// End-to-end check of the on-chain side against a running server. On a local node (anvil) the visitor is anvil's
// second dev account, which anvil signs for, and the agent is the server's own key; on the testnet one wallet
// (.keys/evm-testnet) plays both, the cheapest setup. Each step's cost is read from the receipts of its own
// transactions, so the agent's background seals on the same wallet do not blur the numbers.
//   node scripts/chain-e2e.mjs [base url]
// CRON_SECRET (the server's) runs the sweep and the receipt checkpoint on demand instead of waiting for the loop.
import fs from "node:fs";
import path from "node:path";
import { createDecipheriv, pbkdf2Sync, scryptSync } from "node:crypto";
import { createPublicClient, createWalletClient, defineChain, erc20Abi, formatEther, formatUnits, getAddress, http, keccak256, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const CRON = process.env.CRON_SECRET;
const RPCS = {
  31337: ["http://127.0.0.1:8545"],
  46630: ["https://rpc.testnet.chain.robinhood.com", "https://robinhood-testnet.drpc.org"],
  4663: ["https://rpc.mainnet.chain.robinhood.com", "https://robinhood.drpc.org"],
};
const ANVIL_VISITOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const GROUPS = ["dopamine neurons", "GABA neurons", "glutamate neurons", "microglia", "astrocytes", "oligodendrocytes", "OPCs", "endothelial"];
const AXES = ["braak", "nigra", "resilience"];
// candidates for the wallet prediction: first the ones that hold on the simulated cohort (so the reward path runs there),
// then every other gene x cell group x outcome, so a long-running ledger that already holds the first ones still has a
// fresh one. On a real atlas few predictions hold, and the reward step is then skipped with a note rather than failed.
const HOLDS = ["SLC6A3", "PACRG", "NR1H2", "MASTL", "TH", "KCNJ6", "DDC", "ALDH1A1", "RET", "SLC18A2"].map((gene) => ({ gene, group: "dopamine neurons", axis: "braak" }));
const MORE = ["LRRK2", "GBA1", "SNCA", "PINK1", "PRKN", "VPS35", "TMEM175", "GPNMB", "RAB32", "SYT11", "BST1", "DNAJC6"].flatMap((gene) =>
  ["dopamine neurons", "microglia", "astrocytes", "oligodendrocytes"].flatMap((group) => ["braak", "resilience", "nigra"].map((axis) => ({ gene, group, axis }))));
const registry = parseAbi([
  "function register(bytes32 hash, string gene, uint8 group, uint8 axis)",
  "function reward(bytes32 hash)",
  "function prediction(bytes32 hash) view returns ((address predictor, uint40 registeredAt, uint40 resolvedAt, uint8 group, uint8 axis, uint8 status, bool rewarded, bytes16 gene, int16 effectDiscovery, int16 effectReplication, uint32 receiptNo))",
]);

// ---------------------------------------------------------------- helpers
async function api(p, body) {
  const r = await fetch(BASE + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
const cron = (task) => (CRON ? fetch(`${BASE}/api/cron?task=${task}`, { headers: { authorization: `Bearer ${CRON}` } }).then((r) => r.json()) : null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const need = (cond, msg) => { if (!cond) throw new Error(msg); };
const canon = (o) => "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + JSON.stringify(o[k])).join(",") + "}";
const sha256 = async (s) => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).toString("hex");
// lib/chain/config.ts proofMessage, with the brand in front
const proof = (action, wallet, extra = {}) =>
  [`parkinson ${action}`, `wallet: ${wallet}`, ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`), `day: ${new Date().toISOString().slice(0, 10)}`].join("\n");

/** Web3 Secret Storage v3, as `cast wallet new` writes it */
function keystoreKey(file, passFile) {
  const { crypto: c } = JSON.parse(fs.readFileSync(file, "utf8"));
  const k = c.kdfparams, salt = Buffer.from(k.salt, "hex"), password = fs.readFileSync(passFile, "utf8").trim();
  const dk = c.kdf === "scrypt" ? scryptSync(password, salt, k.dklen, { N: k.n, r: k.r, p: k.p, maxmem: 256 * k.n * k.r }) : pbkdf2Sync(password, salt, k.c, k.dklen, "sha256");
  const ct = Buffer.from(c.ciphertext, "hex");
  if (keccak256(Buffer.concat([dk.subarray(16, 32), ct])).slice(2) !== c.mac) throw new Error("the keystore password does not match");
  const d = createDecipheriv("aes-128-ctr", dk.subarray(0, 16), Buffer.from(c.cipherparams.iv, "hex"));
  return `0x${Buffer.concat([d.update(ct), d.final()]).toString("hex")}`;
}

async function pickRpc(id) {
  for (const url of process.env.RPC_URL ? [process.env.RPC_URL] : RPCS[id] ?? []) {
    try {
      const c = createPublicClient({ transport: http(url, { timeout: 10_000 }) });
      if ((await c.getChainId()) === id) return url;
    } catch { /* next one */ }
  }
  throw new Error(`no RPC for chain ${id} answered; set RPC_URL`);
}

// ---------------------------------------------------------------- setup
const s0 = await api("/api/chain");
if (!s0.chain) { console.error(`${BASE}/api/chain did not answer: ${s0.error ?? s0.status}`); process.exit(1); }
const chainId = s0.chain.id;
const RPC = await pickRpc(chainId);
const chain = defineChain({ id: chainId, name: s0.chain.name, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC) });
const keyFile = process.env.SIGNER_KEYSTORE ?? path.join(process.cwd(), ".keys", "evm-testnet");
const account = chainId === 31337 ? getAddress(ANVIL_VISITOR) : privateKeyToAccount(keystoreKey(keyFile, process.env.SIGNER_PASSWORD_FILE ?? `${keyFile}.pass`));
const visitor = createWalletClient({ account, chain, transport: http(RPC) });
const wallet = typeof account === "string" ? account : account.address;
const REG = s0.registry, TOKEN = s0.gate?.token;
// signing a prediction costs the predictor nothing (the agent registers it and pays), so off the local node a fresh key
// signs it: the server then pays the reward itself, and the per-wallet limit on prepared predictions starts from zero
const predictor = chainId === 31337 ? account : privateKeyToAccount(generatePrivateKey());
const predictorAddress = typeof predictor === "string" ? predictor : predictor.address;
const tokens = async (owner = wallet) => (TOKEN ? Number(formatUnits(await pub.readContract({ address: TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [owner] }), 18)) : 0);
/** the balance once the node we read from has caught up with a transfer just made */
async function tokensAfter(before, owner = wallet) {
  for (let i = 0; i < 8; i++) {
    const now = await tokens(owner);
    if (now !== before) return now;
    await wait(1500);
  }
  return tokens(owner);
}
/** a registry call from the visitor that must not revert */
async function send(call) {
  const hash = await visitor.writeContract({ account, address: REG, abi: registry, ...call });
  const r = await pub.waitForTransactionReceipt({ hash });
  need(r.status === "success", `${call.functionName} reverted: ${hash}`);
  return hash;
}

const rows = [];
let failures = 0;
async function step(name, fn) {
  try {
    const out = (await fn()) ?? {};
    let gas = 0n, wei = 0n;
    for (const h of new Set([out.txs ?? []].flat().filter((t) => /^0x[0-9a-fA-F]{64}$/.test(t ?? "")))) {
      const r = await pub.getTransactionReceipt({ hash: h });
      gas += r.gasUsed; wei += r.gasUsed * r.effectiveGasPrice;
    }
    rows.push({ name, ok: true, gas, wei, note: out.note ?? "" });
    console.log(`  ok    ${name}${out.note ? `: ${out.note}` : ""}`);
  } catch (e) {
    failures++;
    rows.push({ name, ok: false, gas: 0n, wei: 0n, note: e.message });
    console.log(`  FAIL  ${name}: ${e.shortMessage ?? e.message}`);
  }
}

// ---------------------------------------------------------------- the run
console.log(`server  ${BASE}\nchain   ${s0.chain.name} (${chainId}) via ${RPC}\nvisitor ${wallet}\nagent   ${s0.agent}\n`);
const startEth = await pub.getBalance({ address: wallet });

await step("the server runs the registry contract", async () => {
  need(s0.mode === "contract", `chain mode is ${s0.mode}`);
  need(REG, "no registry address");
  return { note: `registry ${REG}, ${s0.state?.predictions ?? 0} wallet predictions on-chain, agent holds ${s0.agentEth} ETH` };
});

await step("the faucet sends test tokens to the wallet", async () => {
  const before = await tokens();
  const r = await api("/api/chain/faucet", { wallet, signature: await visitor.signMessage({ account, message: proof("faucet", wallet) }) });
  if (r.status === 429) return { note: `skipped (${r.error}); balance ${before}` };
  need(r.tx, r.error ?? "no transaction");
  return { txs: r.tx, note: `${before} → ${await tokensAfter(before)} tPARKINSON` };
});

await step("a holder puts a gene at the front of the queue", async () => {
  const gene = "GPNMB";
  const r = await api("/api/queue", { gene, wallet, signature: await visitor.signMessage({ account, message: proof("queue", wallet, { gene }) }) });
  need(r.gene, r.error ?? "not queued");
  return { note: `${r.gene} at position ${r.position} (wallet holds ${r.balance})` };
});

let held = null;
await step("wallet prediction: the wallet signs (EIP-712), the agent registers it and pays, then it is tested and resolved", async () => {
  // skip what the ledger or the contract already holds before asking the server, which limits prepares per wallet
  const cohort = (await api("/api/atlas")).id;
  const seen = new Map();
  for (const p of [...HOLDS, ...MORE]) {
    if (!seen.has(p.gene)) seen.set(p.gene, new Set(((await api(`/api/experiments?gene=${p.gene}&limit=500`)).results ?? []).map((e) => e.registration)));
    const reg = await sha256(canon({ axis: p.axis, cohort, gene: p.gene, group: p.group, protocol: 2 }));
    if (seen.get(p.gene).has(reg) || (await pub.readContract({ address: REG, abi: registry, functionName: "prediction", args: [`0x${reg}`] })).status !== 0) continue;
    const prep = await api("/api/predict/prepare", { ...p, by: "e2e", wallet: predictorAddress });
    // made before, here or (by an earlier run against another ledger) on this contract
    if (prep.repeat || /already registered on-chain/.test(prep.error ?? "")) continue;
    need(prep.typed, prep.error ?? "nothing to sign");
    const signature = await visitor.signTypedData({ account: predictor, ...prep.typed });
    const before = await tokens(predictorAddress);
    const r = await api("/api/predict/submit", { registration: prep.registration, signature });
    need(r.registration, r.error ?? "submit failed");
    need(r.chain_status === "resolved" || r.chain_status === "rewarded", `chain status ${r.chain_status}`);
    // the server waited for its own receipts; the node this script reads from can be a block or two behind
    let onChain;
    for (let i = 0; i < 10; i++) {
      onChain = await pub.readContract({ address: REG, abi: registry, functionName: "prediction", args: [`0x${r.registration}`] });
      if (onChain.status !== 1) break;
      await wait(1500);
    }
    need(onChain.predictor.toLowerCase() === predictorAddress.toLowerCase(), `stored predictor is ${onChain.predictor}`);
    need(onChain.status === (r.passed ? 2 : 3), `stored status ${onChain.status}`);
    held = r;
    const paid = r.reward_tx ? `, rewarded ${(await tokensAfter(before, predictorAddress)) - before} tPARKINSON` : "";
    return { txs: [r.chain_tx, r.resolve_tx, r.reward_tx], note: `${r.gene} ${r.group} ${r.axis} signed by ${predictorAddress.slice(0, 10)}…: ${r.passed ? "held" : "failed"}, ${r.chain_status}${paid}` };
  }
  throw new Error("every candidate was registered before; add genes to MORE");
});

await step("the predictor of a replicated prediction is rewarded once", async () => {
  if (!held?.passed) return { note: "skipped: the wallet prediction did not hold on this atlas, so there is nothing to reward" };
  if (held.reward_tx) return { note: "paid by the server in the step before" };
  if (predictorAddress.toLowerCase() !== s0.agent?.toLowerCase()) throw new Error("the server did not pay the reward");
  // the predictor is the agent itself: the server never pays itself, so the oracle (this wallet) sends it directly
  const before = await tokens(predictorAddress);
  const tx = await send({ functionName: "reward", args: [`0x${held.registration}`] });
  return { txs: tx, note: `${before} → ${await tokensAfter(before, predictorAddress)} tPARKINSON` };
});

await step("a prediction registered straight on the contract is picked up and tested by the server", async () => {
  const cohort = (await api("/api/atlas")).id;
  const known = new Set(((await api(`/api/chain/wallet/${wallet}`)).predictions ?? []).map((x) => x.registration));
  // the first of these that neither this ledger nor the contract has seen
  let p = null, reg = null;
  for (const gene of ["GPNMB", "LRRK2", "SNCA", "GBA1", "PINK1", "VPS35", "TMEM175", "RAB32", "SYT11", "BST1"]) {
    const h = await sha256(canon({ axis: "braak", cohort, gene, group: "microglia", protocol: 2 }));
    if (known.has(h) || (await pub.readContract({ address: REG, abi: registry, functionName: "prediction", args: [`0x${h}`] })).status !== 0) continue;
    p = { gene, group: "microglia", axis: "braak" }; reg = h;
    break;
  }
  need(p, "every candidate is registered already; add genes to the list");
  const find = async () => (await api(`/api/chain/wallet/${wallet}`)).predictions?.find((x) => x.registration === reg);
  const tx = await send({ functionName: "register", args: [`0x${reg}`, p.gene, GROUPS.indexOf(p.group), AXES.indexOf(p.axis)] });
  // the server sweeps every five minutes; with CRON_SECRET it sweeps now
  for (let i = 0; i < 48; i++) {
    if (i === 0) await cron("sync");
    const x = await find();
    if (x?.resolve_tx) return { txs: [tx, x.resolve_tx, x.reward_tx], note: `${x.gene} ${x.group} ${x.axis}: ${x.passed ? "held" : "failed"}, ${x.chain_status} after ${i * 10}s` };
    await wait(10_000);
  }
  throw new Error("not picked up within 8 minutes");
});

await step("the agent seals its own predictions for a gene in one transaction", async () => {
  for (let i = 0; i < 40; i++) {
    const r = await api("/api/experiments?limit=60");
    const mine = (r.results ?? []).filter((e) => e.source === "agent" && /^0x/.test(e.chain_tx ?? ""));
    const byTx = new Map();
    for (const e of mine) byTx.set(e.chain_tx, [...(byTx.get(e.chain_tx) ?? []), e]);
    const pair = [...byTx.values()].find((v) => v.length >= 2) ?? [...byTx.values()][0];
    if (pair) return { txs: [pair[0].chain_tx, pair[0].resolve_tx], note: `${pair[0].gene}: ${pair.length} seals in ${pair[0].chain_tx.slice(0, 12)}…, results in ${pair[0].resolve_tx?.slice(0, 12) ?? "pending"}…` };
    await wait(15_000);
  }
  throw new Error("the agent sealed nothing on-chain within 10 minutes");
});

await step("the receipt chain head is checkpointed in the registry", async () => {
  for (let i = 0; i < 40; i++) {
    if (i === 0) await cron("anchor");
    const s = await api("/api/chain");
    if (s.anchors?.length && s.state?.receiptHeadNo > 0) return { txs: s.anchors[0].tx, note: `head ${s.state.receiptHeadNo} (${s.state.receiptHeadHash.slice(0, 12)}…)` };
    await wait(15_000);
  }
  throw new Error("no checkpoint within 10 minutes");
});

// ---------------------------------------------------------------- the bill
const eth = (w) => Number(formatEther(w)).toFixed(9);
console.log("\nstep".padEnd(100) + "gas".padStart(12) + "ETH".padStart(14));
for (const r of rows) console.log(`${r.ok ? "  " : "x "}${r.name}`.slice(0, 99).padEnd(99) + String(r.gas).padStart(12) + eth(r.wei).padStart(14));
console.log("".padEnd(99) + String(rows.reduce((a, r) => a + r.gas, 0n)).padStart(12) + eth(rows.reduce((a, r) => a + r.wei, 0n)).padStart(14));
console.log(`\nvisitor ${eth(startEth)} → ${eth(await pub.getBalance({ address: wallet }))} ETH (on one wallet this includes the agent's own writes while this ran)`);
console.log(`${rows.length - failures} of ${rows.length} steps passed`);
process.exit(failures ? 1 : 0);
