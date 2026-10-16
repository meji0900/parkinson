// Registered atlas predictions. A prediction is "gene X in cell group Y moves with outcome Z". It is
// hashed and stored before any expression value is read, then tested on a random half of the donors
// (the split is seeded by the hash, so it cannot be re-rolled) and must hold again, same sign, on the
// other half. Failures print a receipt.
import { addReceipt } from "@/lib/agent/receipts";
import { all, json, nowIso, one, run } from "@/lib/server/db";
import { hashOf } from "@/lib/server/hash";
import { AXIS_LABEL, cohorts, GROUPS, RESILIENCE_STAGE, seeded, type Axis, type Cohort, type Group } from "./cohort";
import { fmtE, fmtP, rankBiserial, residualize, spearman, type Stat } from "./stats";

export const PROTOCOL = 2;
export const ALPHA = 0.05;

export type Checks = {
  composition?: { effect: number; p: number; n: number; ok: boolean };
  second?: { cohort: string; effect: number; p: number; n: number; same_sign: boolean };
};

export type Experiment = {
  registration: string;
  gene: string;
  group: Group;
  axis: Axis;
  cohort: string;
  protocol: number;
  at: string;
  by: string | null;
  wallet: string | null;
  source: string;
  state: "sealed" | "tested";
  passed: boolean | null;
  reason: string | null;
  receipt: number | null;
  discovery: Stat | null;
  replication: Stat | null;
  checks: Checks | null;
  chain_tx: string | null;
  resolve_tx: string | null;
  reward_tx: string | null;
  chain_status: string | null;
  /** the registered arena agent that made it, if any */
  agent: string | null;
};

type Row = Omit<Experiment, "group" | "passed" | "discovery" | "replication" | "checks"> & {
  grp: Group; passed: number | null; discovery: string | null; replication: string | null; checks: string | null;
};
const toExp = (r: Row): Experiment => ({
  ...r, group: r.grp, passed: r.passed == null ? null : !!r.passed,
  discovery: json(r.discovery, null), replication: json(r.replication, null), checks: json(r.checks, null),
});

export const registrationOf = (gene: string, group: Group, axis: Axis, cohortId: string) =>
  hashOf({ axis, cohort: cohortId, gene, group, protocol: PROTOCOL });

export function getExperiment(registration: string): Experiment | null {
  const r = one<Row>("select * from experiments where registration = ?", registration);
  return r ? toExp(r) : null;
}

export function listExperiments(opts: { gene?: string; wallet?: string; agent?: string; limit?: number; source?: string } = {}): Experiment[] {
  const where: string[] = [], args: string[] = [];
  if (opts.gene) { where.push("gene = ?"); args.push(opts.gene); }
  if (opts.agent) { where.push("agent = ?"); args.push(opts.agent); }
  if (opts.wallet) { where.push("wallet = ?"); args.push(opts.wallet); }
  if (opts.source) { where.push("source = ?"); args.push(opts.source); }
  const sql = `select * from experiments ${where.length ? "where " + where.join(" and ") : ""} order by at desc limit ${Math.min(opts.limit ?? 200, 2000)}`;
  return all<Row>(sql, ...args).map(toExp);
}

// ---------------------------------------------------------------- statistics on one cohort
export function axisStat(c: Cohort, values: number[], idx: number[], axis: Axis): Stat {
  const d = c.donors;
  if (axis === "resilience") {
    // heavy Lewy pathology either way; resilient donors never developed parkinsonism
    const high = idx.filter((i) => d[i].braak >= RESILIENCE_STAGE);
    const resilient = high.filter((i) => !d[i].parkinsonism).map((i) => values[i]);
    const affected = high.filter((i) => d[i].parkinsonism).map((i) => values[i]);
    const st = rankBiserial(resilient, affected);
    // fewer than three donors on either side cannot show anything; report it as no evidence
    return Math.min(resilient.length, affected.length) < 3 ? { ...st, p: 1 } : st;
  }
  return spearman(idx.map((i) => values[i]), idx.map((i) => d[i][axis]));
}

export function halves(registration: string, n: number): [number[], number[]] {
  const r = seeded("split:" + registration);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return [idx.slice(0, Math.floor(n / 2)), idx.slice(Math.floor(n / 2))];
}

export const everyone = (c: Cohort) => c.donors.map((_, i) => i);

/** values with age, sex and PMI (and optionally the group's share of nuclei) regressed out */
export function adjusted(c: Cohort, values: number[], group: Group, withShare: boolean) {
  const cov = [c.donors.map((d) => d.age), c.donors.map((d) => d.female), c.donors.map((d) => d.pmi)];
  if (withShare) cov.push(c.donors.map((d) => d.share[group]));
  return residualize(values, cov);
}

// ---------------------------------------------------------------- seal, then test
export function seal(input: { gene: string; group: Group; axis: Axis; by?: string | null; wallet?: string | null; agent?: string | null; source: string }) {
  const { primary } = cohorts();
  const registration = registrationOf(input.gene, input.group, input.axis, primary.id);
  const existing = getExperiment(registration);
  if (existing) return { exp: existing, repeat: true };
  run(
    `insert into experiments (registration, gene, grp, axis, cohort, protocol, at, by, wallet, agent, source, state)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sealed')`,
    registration, input.gene, input.group, input.axis, primary.id, PROTOCOL, nowIso(), input.by ?? null, input.wallet ?? null, input.agent ?? null, input.source,
  );
  return { exp: getExperiment(registration)!, repeat: false };
}

const half = (s: Stat | null) => (s ? `${fmtE(s.effect)} p=${fmtP(s.p)} n=${s.n}` : "n/a");

export function test(registration: string): Experiment {
  const exp = getExperiment(registration);
  if (!exp) throw new Error("unknown registration");
  if (exp.state === "tested") return exp;
  const { primary, second } = cohorts();
  const values = primary.expr(exp.gene, exp.group);
  let passed = false, reason: string, disc: Stat | null = null, rep: Stat | null = null, checks: Checks | null = null;

  if (!values) {
    reason = `${exp.gene} is not measured in ${exp.group}`;
  } else {
    const [a, b] = halves(registration, primary.donors.length);
    disc = axisStat(primary, values, a, exp.axis);
    rep = axisStat(primary, values, b, exp.axis);
    passed = disc.p < ALPHA && rep.p < ALPHA && Math.sign(disc.effect) === Math.sign(rep.effect);
    reason = passed
      ? `replicated (${disc.stat} ${fmtE(disc.effect)} then ${fmtE(rep.effect)})`
      : disc.p >= ALPHA
        ? `no effect in discovery (${disc.stat} ${fmtE(disc.effect)}, p ${fmtP(disc.p)})`
        : `did not replicate (discovery ${fmtE(disc.effect)} p ${fmtP(disc.p)}; held-out ${fmtE(rep.effect)} p ${fmtP(rep.p)})`;
    if (passed) {
      // automatic confirmation: the cell mix controlled, then a second brain region
      const comp = axisStat(primary, adjusted(primary, values, exp.group, true), everyone(primary), exp.axis);
      checks = { composition: { effect: comp.effect, p: comp.p, n: comp.n, ok: comp.p < ALPHA && Math.sign(comp.effect) === Math.sign(disc.effect) } };
      const v2 = second.expr(exp.gene, exp.group);
      if (v2) {
        const s = axisStat(second, v2, everyone(second), exp.axis);
        checks.second = { cohort: second.id, effect: s.effect, p: s.p, n: s.n, same_sign: Math.sign(s.effect) === Math.sign(disc.effect) };
      }
    }
  }

  let receipt: number | null = null;
  if (!passed) {
    receipt = addReceipt({
      kind: "atlas", subject: exp.gene, group: exp.group, axis: exp.axis, asked_by: exp.by, why: reason,
      registration, source: primary.label,
      tried: [
        { reader: "prediction", result: `${exp.gene} in ${exp.group} ${AXIS_LABEL[exp.axis]}` },
        { reader: "registered", result: registration.slice(0, 16) },
        { reader: "discovery", score: half(disc) },
        { reader: "replication", score: half(rep) },
      ],
    }).no;
  }
  run(
    "update experiments set state = 'tested', passed = ?, reason = ?, receipt = ?, discovery = ?, replication = ?, checks = ? where registration = ?",
    passed ? 1 : 0, reason, receipt, disc && JSON.stringify(disc), rep && JSON.stringify(rep), checks && JSON.stringify(checks), registration,
  );
  return getExperiment(registration)!;
}

export const groupsFor = () => [...GROUPS];
