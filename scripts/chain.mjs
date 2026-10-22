// Foundry for this project: build, test, a local node, deploys to Robinhood Chain, and the testnet wallet.
//   node scripts/chain.mjs build | test | node
//   node scripts/chain.mjs wallet            make the testnet wallet (.keys/evm-testnet, encrypted) if missing; print its address and balance
//   node scripts/chain.mjs address           print the testnet wallet's address and balance
//   node scripts/chain.mjs deploy <local|testnet|mainnet> [--broadcast]
// Without --broadcast a deploy is only simulated, and Foundry prints the gas of every transaction.
// local    anvil's first dev account deploys (no key); run `npm run chain:node` first
// testnet  the wallet in .keys/evm-testnet deploys and is the oracle too, the cheapest setup (ORACLE= to use another)
// mainnet  your own keystore account deploys (MAINNET_ACCOUNT, default deployer-mainnet; you type its password), the
//          server's signer must be a different wallet (ORACLE=0x…), and OWNER=<Safe> hands the registry to a multisig
// RPC_URL overrides the endpoint; otherwise the official one is tried first and dRPC second (for blocked networks).
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
// Foundry runs from inside contracts/ (forge script with --root fails on Windows)
const contracts = path.join(root, "contracts");
const KEY = path.join(root, ".keys", "evm-testnet");
const PASS = `${KEY}.pass`;
const ANVIL_DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const NETS = {
  local: { id: 31337, rpc: ["http://127.0.0.1:8545"] },
  testnet: { id: 46630, rpc: ["https://rpc.testnet.chain.robinhood.com", "https://robinhood-testnet.drpc.org"], explorer: "https://explorer.testnet.chain.robinhood.com" },
  mainnet: { id: 4663, rpc: ["https://rpc.mainnet.chain.robinhood.com", "https://robinhood.drpc.org"], explorer: "https://robinhoodchain.blockscout.com" },
};

const exe = (name) => {
  const own = path.join(os.homedir(), ".foundry", "bin", name + (process.platform === "win32" ? ".exe" : ""));
  return fs.existsSync(own) ? own : name;
};
function run(name, args, opts = {}) {
  const r = spawnSync(exe(name), args, { stdio: "inherit", cwd: root, ...opts });
  if (r.error) {
    console.error(`${name} did not start (${r.error.message}). Install Foundry: https://getfoundry.sh`);
    process.exit(1);
  }
  if (r.status && !opts.allowFail) process.exit(r.status);
  return r;
}

async function call(url, method, params = []) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10_000) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

/** the first endpoint that answers with the right chain id */
async function pickRpc(net) {
  const candidates = process.env.RPC_URL ? [process.env.RPC_URL] : net.rpc;
  for (const url of candidates) {
    try {
      if (Number(await call(url, "eth_chainId")) === net.id) return url;
      console.warn(`${url} is not chain ${net.id}`);
    } catch (e) {
      console.warn(`${url} did not answer (${e.cause?.code ?? e.message})`);
    }
  }
  console.error(`no RPC for chain ${net.id} answered; set RPC_URL`);
  process.exit(1);
}

function walletAddress() {
  const r = spawnSync(exe("cast"), ["wallet", "address", "--keystore", KEY, "--password-file", PASS], { cwd: root, encoding: "utf8" });
  const a = r.stdout?.match(/0x[0-9a-fA-F]{40}/)?.[0];
  if (!a) {
    console.error("could not read .keys/evm-testnet; make it with npm run wallet:new");
    process.exit(1);
  }
  return a;
}

async function showWallet() {
  const address = walletAddress();
  console.log(`testnet wallet ${address}`);
  const url = await pickRpc(NETS.testnet);
  const wei = BigInt(await call(url, "eth_getBalance", [address, "latest"]));
  console.log(`balance        ${Number(wei) / 1e18} ETH on Robinhood Chain Testnet`);
  console.log(`explorer       ${NETS.testnet.explorer}/address/${address}`);
}

const [cmd, target] = process.argv.slice(2);
const broadcast = process.argv.includes("--broadcast");

if (cmd === "build") {
  run("forge", ["build"], { cwd: contracts });
  run(process.execPath, [path.join("scripts", "chain-sync.mjs")]);
} else if (cmd === "test") {
  run("forge", ["test", ...process.argv.slice(3)], { cwd: contracts });
} else if (cmd === "node") {
  run("anvil", process.argv.slice(3));
} else if (cmd === "wallet") {
  if (!fs.existsSync(KEY)) {
    fs.mkdirSync(path.dirname(KEY), { recursive: true });
    if (!fs.existsSync(PASS)) fs.writeFileSync(PASS, crypto.randomBytes(24).toString("hex"), { mode: 0o600 });
    // cast prints the file and the address, never the key
    run("cast", ["wallet", "new", path.dirname(KEY), path.basename(KEY)], { env: { ...process.env, CAST_PASSWORD: fs.readFileSync(PASS, "utf8").trim() } });
  }
  await showWallet();
} else if (cmd === "address") {
  await showWallet();
} else if (cmd === "deploy" && NETS[target]) {
  const net = NETS[target];
  const rpc = await pickRpc(net);
  const args = ["script", "script/Deploy.s.sol:Deploy", "--rpc-url", rpc];
  if (target === "local") args.push("--unlocked", "--sender", ANVIL_DEPLOYER);
  if (target === "testnet") args.push("--keystore", KEY, "--password-file", PASS);
  if (target === "mainnet") {
    if (!process.env.ORACLE) {
      console.error("mainnet needs ORACLE=<the server's signer address>, a wallet other than the deployer");
      process.exit(1);
    }
    args.push("--account", process.env.MAINNET_ACCOUNT ?? "deployer-mainnet");
  }
  if (broadcast) {
    args.push("--broadcast");
    if (net.explorer) args.push("--verify", "--verifier", "blockscout", "--verifier-url", `${net.explorer}/api/`);
  }
  console.log(`${broadcast ? "deploying to" : "simulating on"} chain ${net.id} through ${rpc}`);
  run("forge", args, { cwd: contracts });
  if (broadcast) run(process.execPath, [path.join("scripts", "chain-sync.mjs")]);
  else console.log("\nsimulation only; add --broadcast to send it");
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(cmd ? 1 : 0);
}
