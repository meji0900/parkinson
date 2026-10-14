// Read models: everything the pages and the API show is computed here from the ledgers.
import { listReceipts, receiptCount } from "@/lib/agent/receipts";
import { recentRuns, runsFor } from "@/lib/agent/pipeline";
import type { RunRecord } from "@/lib/agent/types";
import { notebookNights, queueLength } from "@/lib/agent/worker";
import { cohorts } from "@/lib/atlas/cohort";
import { ALPHA, listExperiments } from "@/lib/atlas/experiments";
import { listCases, swarmStats } from "@/lib/atlas/swarm";
import { all, json, one } from "@/lib/server/db";

export function atlasInfo() {
  const { primary, second } = cohorts();
  return {
    state: "done",
    simulated: primary.simulated,
    label: primary.label,
    region: primary.region,
    cells: primary.cells,
    donors: primary.donors.length,
    genes: primary.genes,
    groups: ["microglia", "astrocytes", "oligodendrocytes", "OPCs", "endothelial", "VLMC", "excitatory neurons", "inhibitory neurons"],
    second: { label: second.label, region: second.region, donors: second.donors.length, simulated: second.simulated },
  };
}

export function funnel() {
  const { primary } = cohorts();
  const t = one<{ n: number; held: number }>(
    "select count(*) as n, coalesce(sum(passed), 0) as held from experiments where state = 'tested' and protocol = 2 and cohort = ?", primary.id,
  ) ?? { n: 0, held: 0 };
  const held = listExperiments({ limit: 2000 }).filter((e) => e.passed && e.cohort === primary.id);
  const comp = held.filter((e) => e.checks?.composition?.ok).length;
  const same = held.filter((e) => e.checks?.second?.same_sign);
  const nominal = same.filter((e) => (e.checks?.second?.p ?? 1) < ALPHA).length;
  const strict = same.filter((e) => (e.checks?.second?.p ?? 1) < ALPHA / Math.max(1, held.length)).length;
  return {
    simulated: primary.simulated,
    cohort: primary.label,
    stages: [
      { key: "tested", n: t.n, label: `predictions tested on the ${primary.region} cohort` },
      { key: "held", n: t.held, label: "held in both donor halves" },
      { key: "composition", n: comp, of: held.length, label: "still hold with the cell-type mix controlled" },
      { key: "second_same", n: same.length, of: held.length, label: "point the same way in the second region" },
      { key: "second_nominal", n: nominal, label: "nominally significant there (p < 0.05)" },
      { key: "second_strict", n: strict, label: "survive correction for every test" },
    ],
    receipts: receiptCount(),
    swarm: swarmStats(),
    by_source: all<{ source: string; n: number; held: number }>(
      "select source, count(*) as n, coalesce(sum(passed), 0) as held from experiments where state = 'tested' group by source",
    ),
  };
}

export function notebook() {
  const nights = notebookNights(1);
  const night = nights[0];
  const picks = night
    ? json<{ symbol: string }[]>(night.data, [])
    : all<{ symbol: string }>("select symbol from runs where passed = 1 group by symbol order by max(score) desc limit 12");
  const entries = picks
    .map((p) => runsFor(p.symbol, 1)[0])
    .filter((r): r is RunRecord => !!r && !!r.hypothesis)
    .map((r) => ({ symbol: r.symbol, name: r.name, at: r.at, hypothesis: r.hypothesis! }));
  return {
    night: night?.night ?? null,
    at: night?.at ?? null,
    pool: night?.pool ?? null,
    investigated: night?.investigated ?? one<{ n: number }>("select count(distinct symbol) as n from runs")?.n ?? 0,
    entries,
  };
}

export function geneRecord(symbol: string) {
  const runs = runsFor(symbol, 5);
  return {
    symbol,
    latest: runs[0] ?? null,
    history: runs.map((r) => ({ at: r.at, score: r.score, passed: r.passed, receipt: r.receipt ?? null })),
    experiments: listExperiments({ gene: symbol }),
    receipts: listReceipts(30, undefined, symbol),
    swarm: listCases(10, symbol),
  };
}

export function leaderboard(limit = 20) {
  return all<{ wallet: string; n: number; held: number; rewarded: number; last: string }>(
    `select wallet, count(*) as n, coalesce(sum(passed), 0) as held, sum(case when reward_tx is not null then 1 else 0 end) as rewarded, max(at) as last
     from experiments where wallet is not null and state = 'tested' group by wallet order by held desc, n desc limit ?`, limit,
  );
}

export function report(day: string) {
  const next = new Date(Date.parse(day + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const between = "at >= ? and at < ?";
  const c = (sql: string) => one<{ n: number }>(sql, day, next)?.n ?? 0;
  const genes = c(`select count(distinct symbol) as n from runs where ${between}`);
  const proposals = c(`select count(*) as n from runs where passed = 1 and ${between}`);
  const receipts = c(`select count(*) as n from receipts where ${between}`);
  const tested = c(`select count(*) as n from experiments where state = 'tested' and ${between}`);
  const held = c(`select count(*) as n from experiments where passed = 1 and ${between}`);
  const visitors = c(`select count(*) as n from experiments where source in ('visitor', 'wallet', 'onchain', 'mcp') and ${between}`);
  const cases = c(`select count(*) as n from swarm_cases where opened >= ? and opened < ?`);
  const heldRows = all<{ gene: string; grp: string; axis: string }>(`select gene, grp, axis from experiments where passed = 1 and ${between} order by at`, day, next);
  const best = all<{ symbol: string; score: number }>(`select symbol, max(score) as score from runs where passed = 1 and ${between} group by symbol order by score desc limit 5`, day, next);
  const { primary } = cohorts();
  const post = [
    `${day} · engram, Alzheimer's research in the open`,
    `${genes} genes read · ${proposals} lab proposals · ${receipts} receipts`,
    `${tested} sealed predictions tested · ${held} held in both donor halves${primary.simulated ? " (simulated cohort)" : ""}`,
    best.length ? `best case today: ${best.map((b) => `${b.symbol} ${b.score.toFixed(2)}`).join(", ")}` : "",
    "every failure has a public receipt.",
  ].filter(Boolean).join("\n");
  return { day, genes, proposals, receipts, tested, held, visitors, cases, held_rows: heldRows, best, post };
}

export function reportDays(limit = 14) {
  return all<{ day: string; n: number }>("select substr(at, 1, 10) as day, count(*) as n from runs group by day order by day desc limit ?", limit);
}

export function overview() {
  return { runs: recentRuns(20), queue: queueLength(), receipts: receiptCount() };
}
