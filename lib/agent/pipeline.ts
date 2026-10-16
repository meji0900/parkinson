// One investigation, start to finish. Every step is emitted as an event, so the same run can stream to
// a visitor's terminal, feed the live page, or be replayed later from the stored record.
import { AXIS_LABEL, AXIS_SHORT, cohorts, type Axis } from "@/lib/atlas/cohort";
import { seal, test, type Experiment } from "@/lib/atlas/experiments";
import { fmtE, fmtP, type Stat } from "@/lib/atlas/stats";
import { openCase } from "@/lib/atlas/swarm";
import { all, json, nowIso, one, run } from "@/lib/server/db";
import type { AgentEvent } from "@/lib/server/events";
import { sleep } from "@/lib/server/http";
import { DIM, merge } from "./hrr";
import { groupForCell, writeHypothesis } from "./hypothesis";
import { readCell, readChem, readClinic, readGenetics, readLit, readPath, resolveGene } from "./readers";
import { addReceipt, type ReceiptKind } from "./receipts";
import { FACET_LABEL, FACETS, SOURCE, THRESHOLD, WEIGHTS, level, type CellKind, type Facet, type Finding, type GeneRef, type RunRecord } from "./types";

export type Emit = (e: AgentEvent) => void | Promise<void>;
export type Hooks = {
  /** called once a gene's predictions are sealed and before any data is read (the on-chain registration) */
  onSeal?: (exps: Experiment[]) => Promise<void>;
  /** called once their split-half results exist (the on-chain resolution) */
  onTested?: (exps: Experiment[]) => Promise<void>;
};

const NEED: Record<Facet, string> = {
  genetics: "a genetic association with Parkinson's",
  cell: "a clear home in dopamine neurons, astrocytes or microglia",
  chem: "a binding pocket or a compound that reaches it",
  clinic: "no stopped Parkinson's trials against it",
  lit: "ground that has not been worked over",
  path: "a pathway tied to Parkinson's biology",
};

export const pad = (n: number | null | undefined) => String(n ?? 0).padStart(4, "0");
const fmtStat = (s: Stat | null) => (s ? `${fmtE(s.effect)} (p ${fmtP(s.p)}, n ${s.n})` : "n/a");

function settle(f: Facet, p: Promise<Finding>): Promise<Finding> {
  return p.catch((e: unknown) => ({
    facet: f, ok: false, score: 0, level: "absent" as const, summary: `${SOURCE[f]} did not answer`, detail: {},
    error: e instanceof Error ? e.message : String(e),
  }));
}

export function lastRun(symbol: string) {
  return one<{ at: string; score: number }>("select at, score from runs where symbol = ? order by at desc limit 1", symbol) ?? null;
}

export type Options = { emit: Emit; source: string; pace?: number; atlas?: boolean; swarm?: boolean; hooks?: Hooks };

export async function investigate(raw: string, opts: Options): Promise<RunRecord | null> {
  const t0 = Date.now();
  const events: AgentEvent[] = [];
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
  let G = symbol;
  const say = async (e: Omit<AgentEvent, "gene">) => {
    const ev = { gene: G, ...e } as AgentEvent;
    events.push(ev);
    await opts.emit(ev);
    if (opts.pace) await sleep(opts.pace);
  };

  let gene: GeneRef | null;
  try {
    gene = await resolveGene(symbol);
  } catch {
    const r = addReceipt({ kind: "source", subject: symbol, why: "source failed: Open Targets did not answer the gene lookup", tried: [{ reader: "lookup", source: "Open Targets", result: "no answer" }], need: ["Open Targets to answer"] });
    await say({ k: "wake", x: `subject: ${symbol}. looking ${symbol} up.` });
    await say({ k: "receipt", x: `the gene lookup failed, so i can't start. receipt ${pad(r.no)} printed.`, receipt: r.no });
    return null;
  }
  if (!gene) {
    const r = addReceipt({ kind: "unknown", subject: symbol, why: "not a recognised human gene symbol", tried: [{ reader: "lookup", source: "Open Targets", result: "no exact symbol match" }], need: ["an approved HGNC symbol"] });
    await say({ k: "wake", x: `subject: ${symbol}. looking ${symbol} up.` });
    await say({ k: "receipt", x: `${symbol} is not a human gene symbol i can find. receipt ${pad(r.no)} printed.`, receipt: r.no });
    return null;
  }
  G = gene.symbol;
  const prev = lastRun(G);
  await say({ k: "wake", x: `subject: ${G}. ${G} (${gene.name || "no name on record"}) is on the bench. six readers, six sources.` });
  await say({ k: "src", x: "sources: open targets · human protein atlas · clinicaltrials.gov · pubmed · reactome" });
  if (prev) await say({ k: "recall", x: `i read ${G} on ${prev.at.slice(0, 10)}; it scored ${prev.score.toFixed(2)}. reading again from scratch.` });

  const g = gene;
  const chem = settle("chem", readChem(g));
  const pending: Record<Facet, Promise<Finding>> = {
    genetics: settle("genetics", readGenetics(g)),
    cell: settle("cell", readCell(g)),
    chem,
    clinic: settle("clinic", chem.then((c) => readClinic(g, (c.detail.drugs as string[]) ?? []))),
    lit: settle("lit", readLit(g)),
    path: settle("path", readPath(g)),
  };
  for (const f of FACETS) await say({ k: "open", fac: f, x: `${FACET_LABEL[f]} is reading ${SOURCE[f]}` });
  const findings = {} as Record<Facet, Finding>;
  for (const f of FACETS) {
    findings[f] = await pending[f];
    await say({ k: "find", fac: f, x: `${findings[f].summary}  ·  ${findings[f].score.toFixed(2)}`, score: findings[f].score });
  }
  return conclude(g, findings, events, t0, prev, opts, say);
}

type Say = (e: Omit<AgentEvent, "gene">) => Promise<void>;

async function conclude(
  g: GeneRef, findings: Record<Facet, Finding>, events: AgentEvent[], t0: number,
  prev: { at: string; score: number } | null, opts: Options, say: Say,
): Promise<RunRecord> {
  const G = g.symbol;
  const score = Math.round(FACETS.reduce((s, f) => s + WEIGHTS[f] * findings[f].score, 0) * 1000) / 1000;
  const levels = Object.fromEntries(FACETS.map((f) => [f, level(findings[f].score)])) as Record<Facet, ReturnType<typeof level>>;
  const m = merge(levels);
  await say({ k: "merge", x: `merged six findings into one ${DIM}-number vector · sha ${m.sha}`, rec: m.recovered, findings: levels });

  const failed = FACETS.filter((f) => !findings[f].ok);
  const lost = FACETS.filter((f) => !m.recovered[f].ok);
  const kind: ReceiptKind | null = failed.length ? "source" : lost.length ? "lost" : score < THRESHOLD ? "weak" : null;
  const record: RunRecord = {
    symbol: G, ensg: g.ensg, name: g.name, at: nowIso(), findings, score, passed: !kind, merge: m, elapsed: (Date.now() - t0) / 1000,
  };

  if (kind) {
    const sank = kind === "source" ? failed : kind === "lost" ? lost
      : FACETS.filter((f) => findings[f].score < 0.35).sort((a, b) => WEIGHTS[b] * (1 - findings[b].score) - WEIGHTS[a] * (1 - findings[a].score));
    const why = kind === "source" ? `source failed: ${failed.map((f) => SOURCE[f]).join(", ")}`
      : kind === "lost" ? `reader lost in the merge: ${lost.map((f) => FACET_LABEL[f]).join(", ")}`
      : `score ${score.toFixed(2)} < ${THRESHOLD}`;
    const r = addReceipt({
      kind, subject: G, why, sank, need: sank.map((f) => NEED[f]), score: score.toFixed(2), elapsed: record.elapsed.toFixed(1),
      tried: FACETS.map((f) => ({ reader: f, source: SOURCE[f], score: findings[f].score.toFixed(2), level: findings[f].level })),
    });
    record.receipt = r.no;
    await say({
      k: "receipt", receipt: r.no,
      x: kind === "weak"
        ? `no case for ${G}: translation score ${score.toFixed(2)}, the bar is ${THRESHOLD}. ${sank.length ? `${FACET_LABEL[sank[0]]} sank it. ` : ""}receipt ${pad(r.no)} printed.`
        : `${why}. receipt ${pad(r.no)} printed.`,
    });
  } else {
    const hyp = writeHypothesis(G, findings, score);
    record.hypothesis = hyp;
    await say({ k: "speak", x: hyp.statement, hyp });
    await say({
      k: "done",
      x: `translation score ${score.toFixed(2)}${prev ? ` (was ${prev.score.toFixed(2)})` : ""}. ${hyp.dissent.length ? `dissent from ${hyp.dissent.map((f) => FACET_LABEL[f]).join(", ")}.` : "no dissent."} lab request written.`,
    });
  }

  if (opts.atlas) await atlasStep(G, (findings.cell.detail.kind as CellKind) ?? "none", opts, say);

  run(
    "insert into runs (symbol, ensg, name, at, score, passed, source, record, events) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    G, g.ensg, g.name, record.at, score, record.passed ? 1 : 0, opts.source, JSON.stringify(record), JSON.stringify(events),
  );
  return record;
}

async function atlasStep(G: string, kind: CellKind, opts: Options, say: Say) {
  const { primary } = cohorts();
  const group = groupForCell(kind);
  await say({ k: "atlas", x: `sealing two predictions for ${G} in ${group} of the ${primary.region} before reading the atlas${primary.simulated ? " (simulated cohort)" : ""}.` });
  const sealed: { exp: Experiment; axis: Axis }[] = [];
  for (const axis of ["braak", "resilience"] as Axis[]) {
    const { exp, repeat } = seal({ gene: G, group, axis, source: "agent" });
    if (repeat) {
      await say({ k: "register", x: `${G} · ${group} · ${axis} was sealed before (${exp.registration.slice(0, 12)}); its result stands: ${exp.reason ?? "pending"}.` });
      continue;
    }
    await say({ k: "register", x: `sealed ${exp.registration.slice(0, 16)}: ${G} ${AXIS_LABEL[axis]} in ${group}` });
    sealed.push({ exp, axis });
  }
  // both seals share one transaction, and both results the next: the fee is per signature, not per memo
  await opts.hooks?.onSeal?.(sealed.map((s) => s.exp)).catch(() => undefined);
  const tested: Experiment[] = [];
  for (const { exp, axis } of sealed) {
    const t = test(exp.registration);
    tested.push(t);
    await say({ k: "test", x: `${AXIS_SHORT[axis]}: discovery half ${fmtStat(t.discovery)} → held-out half ${fmtStat(t.replication)}` });
    if (t.passed) {
      await say({ k: "pass", x: `${G} in ${group} ${AXIS_LABEL[axis]}: held in both halves.` });
      continue;
    }
    await say({ k: "receipt", x: `${t.reason}. receipt ${pad(t.receipt)}.`, receipt: t.receipt });
    if (opts.swarm && t.receipt) {
      await say({ k: "swarm", fac: "swarm", x: `six analysts open a case on receipt ${pad(t.receipt)}.` });
      const sc = openCase(t.receipt, t);
      for (const a of sc.agents) await say({ k: "swarm", fac: a.agent, x: a.said });
      await say({ k: "swarm", fac: "swarm", x: sc.outcome });
    }
  }
  await opts.hooks?.onTested?.(tested).catch(() => undefined);
}

// ---------------------------------------------------------------- stored runs
type RunRow = { id: number; symbol: string; at: string; score: number; passed: number; source: string; record: string; events: string };

export function recentRuns(limit = 30) {
  return all<{ symbol: string; score: number; at: string; source: string }>(
    "select symbol, score, at, source from runs where id in (select max(id) from runs group by symbol) order by at desc limit ?", limit,
  );
}

export function runsFor(symbol: string, limit = 10): RunRecord[] {
  return all<RunRow>("select record from runs where symbol = ? order by at desc limit ?", symbol, limit).map((r) => json<RunRecord>(r.record, null as never));
}

export function storedEvents(symbol: string, maxAgeHours: number): AgentEvent[] | null {
  const r = one<RunRow>("select at, events from runs where symbol = ? order by at desc limit 1", symbol);
  if (!r || Date.now() - Date.parse(r.at) > maxAgeHours * 3600_000) return null;
  return json<AgentEvent[]>(r.events, []);
}
