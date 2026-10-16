// Decodes accounts.json (written by the Rust harness) with the server's own decoders and checks the values.
import fs from "node:fs";
import path from "node:path";
import { decodePrediction, decodeRegistry } from "../../lib/chain/program";

const acc = JSON.parse(fs.readFileSync(path.join("chain", "tests-svm", "accounts.json"), "utf8")) as Record<string, string | null>;
const buf = (k: string) => Buffer.from(acc[k] ?? "", "hex");
const reg = decodeRegistry(buf("registry"))!;
const p1 = decodePrediction(buf("prediction1"))!;
const p2 = decodePrediction(buf("prediction2"))!;
const ata = buf("walletAta");
const tokens = Number(ata.readBigUInt64LE(64)) / 1e6; // SPL token account: mint 32, owner 32, amount u64
const checks: [string, boolean][] = [
  ["registry counts 2 predictions, 2 resolved, 1 replicated", reg.predictions === 2 && reg.resolved === 2 && reg.replicated === 1],
  ["receipt head is no. 5", reg.receiptHeadNo === 5],
  ["reward 50 and faucet 250 tokens", reg.rewardAmount === 50e6 && reg.faucetAmount === 250e6],
  ["prediction 1: LRRK2, replicated, rewarded", p1.gene === "LRRK2" && p1.status === "replicated" && p1.rewarded],
  ["prediction 1 effects survive the round trip", Math.abs(p1.effectDiscovery - 0.3141) < 1e-4 && Math.abs(p1.effectReplication - 0.4242) < 1e-4],
  ["prediction 2: GBA1, failed, receipt 7, group 6, axis 2", p2.gene === "GBA1" && p2.status === "failed" && p2.receiptNo === 7 && p2.group === 6 && p2.axis === 2],
  ["wallet holds reward + faucet = 300 tokens", tokens === 300],
];
for (const [name, ok] of checks) console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
console.log({ registry: reg, prediction1: p1 });
if (checks.some(([, ok]) => !ok)) process.exit(1);
