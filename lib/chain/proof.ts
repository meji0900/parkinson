// The registry's proof of deployment: what the Deploy script broadcast (lib/chain/deployments.json), what the chain says
// about the contract right now, and Sourcify's verdict on its source. Anything that does not answer in time is left out.
import { getJSON } from "@/lib/server/http";
import { within } from "@/lib/server/timeout";
import { registryAbi } from "./abi";
import { CHAIN, DEPLOYED, explorer, REGISTRY, TEST_TOKEN } from "./config";
import { publicClient } from "./oracle";

type Sourcify = {
  match?: string | null;
  compilation?: { compilerVersion?: string; compilerSettings?: { evmVersion?: string; optimizer?: { enabled?: boolean; runs?: number } } };
};
type Verdict = { match: string | null; compiler: string | null; evm: string | null; runs: number | null; link: string };

export type ContractProof = {
  chain: { id: number; name: string };
  registry: { address: string; link: string | null; tx: string | null; txLink: string | null; source: Verdict | null };
  token: { address: string; link: string | null; source: Verdict | null } | null;
  block: number | null;
  at: string | null;
  deployer: string | null;
  /** null when the RPC did not answer; false when there is no code at the address */
  live: boolean | null;
  owner: string | null;
  oracle: string | null;
  predictions: number | null;
  receiptHeadNo: number | null;
};

const g = globalThis as unknown as { __parkinsonProof?: { at: number; proof: ContractProof } };

async function verdict(address: string): Promise<Verdict | null> {
  // Sourcify only knows public chains; a local node has nothing to look up
  if (!explorer("address", address)) return null;
  const link = `https://repo.sourcify.dev/${CHAIN.id}/${address}`;
  const j = await getJSON<Sourcify>("Sourcify", `https://sourcify.dev/server/v2/contract/${CHAIN.id}/${address}?fields=compilation`, undefined, 4000).catch(() => null);
  if (!j) return { match: null, compiler: null, evm: null, runs: null, link };
  const c = j.compilation;
  return {
    match: j.match ?? null,
    compiler: c?.compilerVersion?.split("+")[0] ?? null,
    evm: c?.compilerSettings?.evmVersion ?? null,
    runs: c?.compilerSettings?.optimizer?.enabled ? (c.compilerSettings.optimizer.runs ?? null) : null,
    link,
  };
}

export async function contractProof(): Promise<ContractProof | null> {
  if (!REGISTRY) return null;
  const hit = g.__parkinsonProof;
  if (hit && Date.now() - hit.at < 60_000) return hit.proof;
  const c = publicClient();
  const [code, state, source, tokenSource] = await Promise.all([
    within(c.getCode({ address: REGISTRY }).then((x) => x ?? "0x"), 3000, null),
    within(c.readContract({ address: REGISTRY, abi: registryAbi, functionName: "state" }), 3000, null),
    within(verdict(REGISTRY), 4500, null),
    TEST_TOKEN ? within(verdict(TEST_TOKEN), 4500, null) : null,
  ]);
  const tx = DEPLOYED.txs?.ParkinsonRegistry ?? null;
  const proof: ContractProof = {
    chain: { id: CHAIN.id, name: CHAIN.name },
    registry: { address: REGISTRY, link: explorer("address", REGISTRY), tx, txLink: tx ? explorer("tx", tx) : null, source },
    token: TEST_TOKEN ? { address: TEST_TOKEN, link: explorer("token", TEST_TOKEN), source: tokenSource } : null,
    block: DEPLOYED.block ?? null,
    at: DEPLOYED.at ?? null,
    deployer: DEPLOYED.deployer ?? null,
    live: code == null ? null : code !== "0x",
    owner: state?.owner ?? null,
    oracle: state?.oracle ?? null,
    predictions: state ? Number(state.predictions) : null,
    receiptHeadNo: state ? Number(state.receiptHeadNo) : null,
  };
  // an answer without the chain is not kept, so a slow first call is retried on the next view
  if (proof.live !== null) g.__parkinsonProof = { at: Date.now(), proof };
  return proof;
}
