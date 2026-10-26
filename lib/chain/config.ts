// Chain constants shared by the server and the browser. The registry lives on Robinhood Chain, an Ethereum L2 built
// on Arbitrum with ETH for gas: its testnet (46630), its mainnet (4663), or a local anvil node, picked by
// NEXT_PUBLIC_NETWORK. Deployed addresses come from deployments.json, written by scripts/chain-sync.mjs.
import { defineChain, type Address, type Chain } from "viem";
import { anvil, robinhood, robinhoodTestnet } from "viem/chains";
import { BRAND } from "@/lib/brand";
import deployments from "./deployments.json";

export type Network = "testnet" | "mainnet" | "local";
const asNetwork = (s?: string): Network => (s === "mainnet" || s === "local" ? s : "testnet");
export const NETWORK = asNetwork(process.env.NEXT_PUBLIC_NETWORK);

const BASE = { testnet: robinhoodTestnet, mainnet: robinhood, local: anvil }[NETWORK];
/** the RPC wallets are handed; where an ISP blocks *.robinhood.com, a provider such as dRPC serves the same chain */
export const PUBLIC_RPC = process.env.NEXT_PUBLIC_RPC_URL || BASE.rpcUrls.default.http[0];
export const CHAIN: Chain = defineChain({ ...BASE, rpcUrls: { default: { http: [PUBLIC_RPC] } } });
/** a second public endpoint per chain (dRPC, one of the providers Robinhood's docs list) that the server falls back to */
export const BACKUP_RPC: Record<number, string> = { [robinhoodTestnet.id]: "https://robinhood-testnet.drpc.org", [robinhood.id]: "https://robinhood.drpc.org" };

export type Deployment = {
  ParkinsonRegistry?: string; ParkinsonTestToken?: string; block?: number | null; at?: string | null; deployer?: string | null;
  txs?: { ParkinsonRegistry?: string; ParkinsonTestToken?: string };
};
/** this network's deployment as the Deploy script broadcast it: addresses, block, time, deployer, transactions */
export const DEPLOYED: Deployment = (deployments as Record<string, Deployment>)[String(CHAIN.id)] ?? {};
const address = (...xs: (string | undefined)[]) => (xs.find((x) => x && /^0x[0-9a-fA-F]{40}$/.test(x)) ?? null) as Address | null;

export const REGISTRY = address(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS, DEPLOYED.ParkinsonRegistry);
export const TEST_TOKEN = NETWORK === "mainnet" ? null : address(DEPLOYED.ParkinsonTestToken);
/** the token a wallet must hold to queue a gene: the test token off mainnet, the launched token on it */
export const GATE_TOKEN = address(process.env.NEXT_PUBLIC_GATE_TOKEN, NETWORK === "mainnet" ? BRAND.ca : (TEST_TOKEN ?? undefined));
export const GATE_AMOUNT = Number(process.env.NEXT_PUBLIC_GATE_AMOUNT ?? 100);
export const TOKEN_SYMBOL = NETWORK === "mainnet" ? BRAND.ticker.replace(/^\$/, "") : "tPARKINSON";

const EXPLORERS: Record<string, string> = {
  [robinhoodTestnet.id]: robinhoodTestnet.blockExplorers.default.url,
  [robinhood.id]: robinhood.blockExplorers.default.url,
};
/** a Blockscout link on the chain a record was written to (records keep their chain id), or null on a local node */
export const explorer = (kind: "tx" | "address" | "token", id: string, chain: number | string | null = CHAIN.id) => {
  const base = EXPLORERS[String(chain ?? CHAIN.id)];
  return base ? `${base}/${kind}/${id}` : null;
};
export const isTxHash = (s: unknown): s is string => typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s);

/** what a wallet signs to have the agent register its prediction (EIP-712; the contract checks the same struct) */
export const REGISTER_TYPES = {
  Register: [
    { name: "hash", type: "bytes32" },
    { name: "gene", type: "string" },
    { name: "group", type: "uint8" },
    { name: "axis", type: "uint8" },
  ],
} as const;
export const registerTypedData = (registration: string, gene: string, group: number, axis: number) => ({
  domain: { name: "ParkinsonRegistry", version: "1", chainId: CHAIN.id, verifyingContract: REGISTRY! },
  types: REGISTER_TYPES,
  primaryType: "Register" as const,
  message: { hash: `0x${registration}` as `0x${string}`, gene, group, axis },
});

/** the message a wallet signs to prove it is asking (faucet, queue) */
export const proofMessage = (action: string, wallet: string, extra: Record<string, string> = {}) =>
  [`${BRAND.name} ${action}`, `wallet: ${wallet}`, ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`), `day: ${new Date().toISOString().slice(0, 10)}`].join("\n");

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
