// A visitor's (or another agent's) prediction: resolved, sealed, anchored, tested, resolved on-chain.
import { cohorts, isAxis, isGroup } from "@/lib/atlas/cohort";
import { getExperiment, seal, test } from "@/lib/atlas/experiments";
import { openCase } from "@/lib/atlas/swarm";
import { resolveOnChain, sealOnChain } from "@/lib/chain/oracle";
import { nowIso, run } from "@/lib/server/db";
import { resolveGene } from "./readers";

export type PredictInput = { gene: string; group: string; axis: string; by?: string | null; source: string };

export async function predict(input: PredictInput) {
  if (!isGroup(input.group)) throw new Error("pick one of the atlas cell groups");
  if (!isAxis(input.axis)) throw new Error("pick braak, nigra or resilience");
  const g = await resolveGene(input.gene);
  if (!g) throw new Error(`${input.gene || "that"} is not a human gene symbol on Open Targets`);
  const { exp, repeat } = seal({ gene: g.symbol, group: input.group, axis: input.axis, by: input.by, source: input.source });
  run("insert into visits (at, registration, by, repeat) values (?, ?, ?, ?)", nowIso(), exp.registration, input.by ?? null, repeat ? 1 : 0);
  if (!repeat) {
    await sealOnChain(exp);
    const t = test(exp.registration);
    if (!t.passed && t.receipt) openCase(t.receipt, t);
    await resolveOnChain(t);
  }
  return view(getExperiment(exp.registration)!, repeat);
}

export function view(e: NonNullable<ReturnType<typeof getExperiment>>, repeat = false) {
  return {
    gene: e.gene, group: e.group, axis: e.axis, registration: e.registration, registered_at: e.at,
    by: e.by, wallet: e.wallet, discovery: e.discovery, replication: e.replication, passed: e.passed,
    reason: e.reason, receipt: e.receipt, repeat, checks: e.checks, chain_tx: e.chain_tx, resolve_tx: e.resolve_tx,
    reward_tx: e.reward_tx, chain_status: e.chain_status, simulated: cohorts().primary.simulated,
  };
}
