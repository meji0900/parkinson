// The research gym: the swarm's six analysts scored on research questions whose answers are already in
// the ledgers.
//   Replication: a prediction cleared p < 0.05 in its discovery half. Will it hold in the other half? The
//   analysts see only the discovery-half donors (the split is rebuilt from the registration hash).
//   Follow-up: the swarm proposed a prediction after a failure. Will it point the same way, at p < 0.05,
//   in the second region? The analysts see only the primary cohort.
// Each analyst turns what it reads into a number between 0 and 1. The gym scores those as probabilities
// (Brier score, AUC), fits how much each analyst should count on one set of genes (train), checks the fit
// on genes it never saw (dev), then seals the fitted weights by hash and scores them only on predictions
// registered after the seal. "Tuning" is fitting six weights; no language model is trained.
import { createHash } from "node:crypto";
import { all, json, kvGet, kvSet, nowIso } from "@/lib/server/db";
import { hashOf } from "@/lib/server/hash";
import { cohorts, isAxis, isGroup, type Axis, type Cohort, type Group } from "./cohort";
import { ALPHA, axisStat, everyone, halves, listExperiments, PROTOCOL } from "./experiments";
import { mean, rankBiserial, residualize, zP, type Stat } from "./stats";

export const ANALYSTS = ["power", "confounder", "composition", "cell type", "axis", "skeptic"] as const;
export type Analyst = (typeof ANALYSTS)[number];
export const ANALYST_READS: Record<Analyst, string> = {
  power: "chance the effect clears the next test, given its size and the donors",
  confounder: "share of the effect left after age, sex and post-mortem interval",
  composition: "share of the effect left after the cell group's share of nuclei",
  "cell type": "how well the gene is measured in this group",
  axis: "whether the gene moves the expected way on the other pathology measure",
  skeptic: "the worst p after dropping one donor; the effect without the most severe",
};

export type Task = {
  kind: "replication" | "followup"; ref: string; gene: string; group: Group; axis: Axis; at: string;
  x: number[]; y: 0 | 1; split: "train" | "dev";
};

const round = (v: number) => Math.round(v * 1000) / 1000;
const phi = (x: number) => (x >= 0 ? 1 - zP(x) / 2 : zP(x) / 2);
const sigmoid = (v: number) => 1 / (1 + Math.exp(-v));
export const splitOf = (gene: string): "train" | "dev" => (createHash("sha256").update("gym:" + gene).digest()[0] < 179 ? "train" : "dev");

/** what the six analysts read from one set of donors */
function readings(c: Cohort, values: number[], idx: number[], axis: Axis, nextN: number, group: Group): number[] {
  const base = axisStat(c, values, idx, axis);
  const sign = Math.sign(base.effect) || 1;
  const sub = (f: (i: number) => number) => idx.map(f);
  const place = (v: number[]) => { const out = new Array<number>(values.length).fill(0); idx.forEach((i, k) => (out[i] = v[k])); return out; };
  const vals = sub((i) => values[i]);
  const covs = c.covariates.map((k) => sub((i) => c.donors[i][k]));
  const kept = (s: Stat) => (Math.sign(s.effect) === sign ? Math.min(1, Math.abs(s.effect) / Math.max(1e-6, Math.abs(base.effect))) : 0);

  const r = Math.min(0.95, Math.abs(base.effect));
  const power = phi(Math.atanh(r) * Math.sqrt(Math.max(1, nextN - 3)) - 1.96);
  const conf = kept(axisStat(c, place(residualize(vals, covs)), idx, axis));
  const comp = kept(axisStat(c, place(residualize(vals, [...covs, sub((i) => c.donors[i].share[group])])), idx, axis));
  const m = mean(vals), sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
  const cell = m > 0 ? m / (m + sd) : 0;
  const other = c.axes.find((a) => a !== axis && a !== "resilience") ?? (axis === "resilience" ? "braak" : axis);
  const os = other === axis ? { effect: 0, p: 1, n: 0, stat: "none" } : axisStat(c, values, idx, other);
  const expect = axis === "resilience" ? -sign : sign; // a gene higher in resilient donors should fall with stage
  const ax = Math.sign(os.effect) === expect ? 1 - Math.min(1, os.p) : 0;
  const loo = idx.map((drop) => axisStat(c, values, idx.filter((i) => i !== drop), axis));
  const worst = Math.max(...loo.map((s) => (Math.sign(s.effect) === sign ? s.p : 1)));
  const mild = c.axes.includes("braak") ? axisStat(c, values, idx.filter((i) => c.donors[i].braak < 6), axis) : base;
  const skeptic = 0.5 * Math.min(1, -Math.log10(Math.max(worst, 1e-12)) / 3) + 0.5 * (Math.sign(mild.effect) === sign && mild.p < 0.1 ? 1 : 0);
  return [power, conf, comp, cell, ax, skeptic].map(round);
}

// ---------------------------------------------------------------- the tasks, rebuilt from the ledgers
const g = globalThis as unknown as { __jamesGym?: Map<string, Task | null> };
const memo = (g.__jamesGym ??= new Map());

export function replicationTasks(): Task[] {
  const { primary: c } = cohorts();
  const out: Task[] = [];
  for (const e of listExperiments({ limit: 2000 })) {
    if (e.state !== "tested" || e.cohort !== c.id || !e.discovery || !e.replication || e.discovery.p >= ALPHA) continue;
    const key = "rep:" + e.registration;
    if (!memo.has(key)) {
      const values = c.expr(e.gene, e.group);
      if (!values) { memo.set(key, null); continue; }
      const [a, b] = halves(e.registration, c.donors.length);
      const nextN = e.axis === "resilience" ? b.filter((i) => c.donors[i].braak >= c.resilienceStage).length : b.length;
      memo.set(key, {
        kind: "replication", ref: e.registration, gene: e.gene, group: e.group, axis: e.axis, at: e.at,
        x: readings(c, values, a, e.axis, nextN, e.group), y: e.passed ? 1 : 0, split: splitOf(e.gene),
      });
    }
    const t = memo.get(key);
    if (t) out.push(t);
  }
  return out;
}

export function followupTasks(): Task[] {
  const { primary: c, second } = cohorts();
  const out: Task[] = [];
  const rows = all<{ registration: string; gene: string; grp: string; axis: string; at: string; result: string; same_sign: number }>(
    "select registration, gene, grp, axis, at, result, same_sign from followups order by at",
  );
  for (const r of rows) {
    if (!isGroup(r.grp) || !isAxis(r.axis)) continue;
    const key = "fu:" + r.registration;
    if (!memo.has(key)) {
      const res = json<{ p?: number }>(r.result, {});
      const values = c.expr(r.gene, r.grp);
      if (res.p == null || !values) { memo.set(key, null); continue; }
      const nextN = r.axis === "resilience" ? second.donors.filter((d) => d.braak >= second.resilienceStage).length : second.donors.length;
      memo.set(key, {
        kind: "followup", ref: r.registration, gene: r.gene, group: r.grp, axis: r.axis, at: r.at,
        x: readings(c, values, everyone(c), r.axis, nextN, r.grp), y: r.same_sign && res.p < ALPHA ? 1 : 0, split: splitOf(r.gene),
      });
    }
    const t = memo.get(key);
    if (t) out.push(t);
  }
  if (memo.size > 20000) memo.clear();
  return out;
}

// ---------------------------------------------------------------- scoring and fitting
export const brier = (ps: number[], ys: number[]) => (ps.length ? mean(ps.map((p, i) => (p - ys[i]) ** 2)) : null);
export function auc(ps: number[], ys: number[]): number | null {
  const pos = ps.filter((_, i) => ys[i] === 1), neg = ps.filter((_, i) => ys[i] === 0);
  if (!pos.length || !neg.length) return null;
  return (rankBiserial(pos, neg).effect + 1) / 2;
}
export const predict = (w: number[], x: number[]) => sigmoid(w[0] + x.reduce((s, v, j) => s + w[j + 1] * v, 0));

/** logistic regression by gradient descent with a light ridge penalty */
export function fit(tasks: Task[]): number[] {
  const k = ANALYSTS.length;
  const base = mean(tasks.map((t) => t.y));
  const w = new Array<number>(k + 1).fill(0);
  w[0] = Math.log((base + 0.01) / (1 - base + 0.01));
  for (let it = 0; it < 2500; it++) {
    const grad = new Array<number>(k + 1).fill(0);
    for (const t of tasks) {
      const e = predict(w, t.x) - t.y;
      grad[0] += e;
      for (let j = 0; j < k; j++) grad[j + 1] += e * t.x[j];
    }
    for (let j = 0; j <= k; j++) w[j] -= 0.5 * (grad[j] / tasks.length + (j ? 0.02 * w[j] : 0));
  }
  return w.map(round);
}

export type ModelRow = { model: string; brier: number | null; auc: number | null; n: number };
export type Evaluation = {
  ready: boolean; n: number; train: number; dev: number; positives: number; base: number | null;
  rows: ModelRow[]; weights: number[] | null; misses: (Task & { p: number })[];
};

export function evaluate(tasks: Task[]): Evaluation {
  const train = tasks.filter((t) => t.split === "train"), dev = tasks.filter((t) => t.split === "dev");
  const positives = tasks.filter((t) => t.y).length;
  const empty: Evaluation = { ready: false, n: tasks.length, train: train.length, dev: dev.length, positives, base: null, rows: [], weights: null, misses: [] };
  if (train.length < 12 || dev.length < 5 || !train.some((t) => t.y) || !train.some((t) => !t.y)) return empty;
  const base = mean(train.map((t) => t.y));
  const w = fit(train);
  const ys = dev.map((t) => t.y);
  const row = (model: string, ps: number[]): ModelRow => ({ model, brier: brier(ps, ys), auc: auc(ps, ys), n: dev.length });
  const tuned = dev.map((t) => predict(w, t.x));
  const rows = [
    row("always the base rate", dev.map(() => base)),
    row("six analysts, equal weight", dev.map((t) => mean(t.x))),
    ...ANALYSTS.map((a, j) => row(`${a} alone`, dev.map((t) => t.x[j]))),
    row("tuned on train genes", tuned),
  ];
  const misses = dev.map((t, i) => ({ ...t, p: tuned[i] })).sort((a, b) => Math.abs(b.p - b.y) - Math.abs(a.p - a.y)).slice(0, 6);
  return { ready: true, n: tasks.length, train: train.length, dev: dev.length, positives, base, rows, weights: w, misses };
}

// ---------------------------------------------------------------- the seal, and the future
export type GymSeal = { at: string; hash: string; base: number; n_train: number; weights: { replication: number[]; followup: number[] | null } };
const SEAL_KEY = "gym_seal";
export const gymSeal = () => kvGet<GymSeal | null>(SEAL_KEY, null);

/** seals the tuned weights once there is enough to fit; returns the new seal, or null when nothing changed */
export function sealGymIfReady(): GymSeal | null {
  if (gymSeal()) return null;
  const rep = replicationTasks().filter((t) => t.split === "train");
  if (rep.length < 40 || rep.filter((t) => t.y).length < 5 || rep.filter((t) => !t.y).length < 5) return null;
  const fu = followupTasks().filter((t) => t.split === "train");
  const weights = { replication: fit(rep), followup: fu.length >= 20 && fu.some((t) => t.y) && fu.some((t) => !t.y) ? fit(fu) : null };
  const at = nowIso();
  const base = round(mean(rep.map((t) => t.y)));
  const seal: GymSeal = { at, base, n_train: rep.length, weights, hash: hashOf({ at, base, kind: "gym-seal", protocol: PROTOCOL, weights }) };
  kvSet(SEAL_KEY, seal);
  return seal;
}

export function futureScore(seal: GymSeal) {
  const score = (tasks: Task[], w: number[] | null) => {
    const later = tasks.filter((t) => t.at > seal.at);
    if (!w || !later.length) return { n: later.length, brier: null as number | null, base_brier: null as number | null, auc: null as number | null };
    const ys = later.map((t) => t.y), ps = later.map((t) => predict(w, t.x));
    return { n: later.length, brier: brier(ps, ys), base_brier: brier(later.map(() => seal.base), ys), auc: auc(ps, ys) };
  };
  return { replication: score(replicationTasks(), seal.weights.replication), followup: score(followupTasks(), seal.weights.followup) };
}

let cached: { at: number; value: ReturnType<typeof computeGym> } | null = null;
function computeGym() {
  const rep = replicationTasks(), fu = followupTasks();
  const seal = gymSeal();
  return { replication: evaluate(rep), followup: evaluate(fu), seal, future: seal ? futureScore(seal) : null };
}
/** the whole gym, recomputed at most once a minute */
export function gym() {
  if (!cached || Date.now() - cached.at > 60_000) cached = { at: Date.now(), value: computeGym() };
  return cached.value;
}

/** the tasks in a plain question / answer / metadata form, so any agent can be scored on the same set */
export function exportTasks() {
  const q = (t: Task) =>
    t.kind === "replication"
      ? `${t.gene} in ${t.group}: the prediction "${t.axis}" reached p < 0.05 in its discovery half of the donors. Will it hold, same sign at p < 0.05, in the other half?`
      : `${t.gene} in ${t.group}, "${t.axis}": a swarm follow-up chosen on the first region. Will it point the same way at p < 0.05 in the second region?`;
  return [...replicationTasks(), ...followupTasks()].map((t) => ({
    question: q(t), answer: t.y ? "yes" : "no",
    metadata: { kind: t.kind, ref: t.ref, gene: t.gene, group: t.group, axis: t.axis, at: t.at, split: t.split, analysts: Object.fromEntries(ANALYSTS.map((a, j) => [a, t.x[j]])) },
  }));
}
