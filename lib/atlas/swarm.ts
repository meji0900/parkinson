// The swarm: when an atlas prediction fails, six analysts each look at it from one angle. The cell-type
// and axis analysts may propose a better prediction; a proposal must survive the confounder, composition
// and skeptic challenges, then it is registered by hash and tested on the second region at a threshold
// corrected for every follow-up made so far.
import { all, json, nowIso, one, run } from "@/lib/server/db";
import { hashOf } from "@/lib/server/hash";
import { AXIS_LABEL, cohorts, GROUPS, type Axis, type Cohort, type Group } from "./cohort";
import { adjusted, ALPHA, axisStat, confirmStat, covariateWords, everyone, PROTOCOL, type Experiment } from "./experiments";
import { fisherCI, fmtE, fmtP, type Stat } from "./stats";

export type AgentNote = { agent: string; angle: string; said: string };
export type Proposal = {
  gene: string; group: Group; axis: Axis; from: string; effect: number; p: number;
  challenge: Record<"confounder" | "composition" | "skeptic", { ok: boolean; said: string }>;
  survives: boolean;
};
export type Followup = { registration: string; prediction: string; test: string; passed: boolean; same_sign: boolean; alpha: number; reused?: boolean };
export type SwarmCase = { receipt: number; gene: string; group: Group; axis: Axis; opened: string; agents: AgentNote[]; proposals: Proposal[]; outcome: string; followups: Followup[] };

const s = (x: Stat) => `${fmtE(x.effect)} (p ${fmtP(x.p)}, n ${x.n})`;

function challenges(c: Cohort, gene: string, group: Group, axis: Axis, values: number[]) {
  const idx = everyone(c);
  const base = axisStat(c, values, idx, axis);
  const conf = axisStat(c, adjusted(c, values, group, false), idx, axis);
  const comp = axisStat(c, adjusted(c, values, group, true), idx, axis);
  const share = axisStat(c, c.donors.map((d) => d.share[group]), idx, axis);
  const loo = idx.map((drop) => axisStat(c, values, idx.filter((i) => i !== drop), axis).effect);
  const flips = loo.filter((e) => Math.sign(e) !== Math.sign(base.effect)).length;
  // the effect without the most severely affected donors (stage 6), where the atlas is staged
  const staged = c.axes.includes("braak");
  const mild = staged ? axisStat(c, values, idx.filter((i) => c.donors[i].braak < 6), axis) : base;
  const same = (x: Stat) => Math.sign(x.effect) === Math.sign(base.effect);
  return {
    base,
    confounder: { ok: conf.p < ALPHA && same(conf), said: `adjusted for ${covariateWords(c)}: ${s(conf)}. ${conf.p < ALPHA && same(conf) ? "holds up." : "does not hold up."}` },
    composition: {
      ok: comp.p < ALPHA && same(comp),
      said: `${group} share of nuclei vs axis ${fmtE(share.effect)} (p ${fmtP(share.p)}); controlling for it: ${s(comp)}. ${comp.p < ALPHA && same(comp) ? "not the mix." : "could be the mix."}`,
    },
    skeptic: {
      ok: flips === 0 && mild.p < 0.1 && same(mild),
      said: `leave-one-out range ${fmtE(Math.min(...loo))} to ${fmtE(Math.max(...loo))}, sign flips ${flips}${staged ? `; without severely affected donors ${s(mild)}` : ""}. ${flips === 0 && mild.p < 0.1 && same(mild) ? "robust." : "fragile."}`,
    },
  };
}

export function openCase(receipt: number, exp: Experiment): SwarmCase {
  const { primary: c, second } = cohorts();
  const { gene, group, axis } = exp;
  const values = c.expr(gene, group);
  const agents: AgentNote[] = [];
  const proposals: Proposal[] = [];
  if (!values) {
    agents.push({ agent: "cell type", angle: "other cell groups", said: `${gene} is not measured in ${group}; looking elsewhere.` });
  } else {
    const ch = challenges(c, gene, group, axis, values);
    const [lo, hi] = fisherCI(ch.base.effect, ch.base.n);
    agents.push({
      agent: "power", angle: "underpowered or absent?",
      said: `full sample ${s(ch.base)}, 95% CI ${fmtE(lo)} to ${fmtE(hi)}. ${lo < 0 && hi > 0 ? (hi - lo > 0.5 ? "the interval is wide: not enough donors to tell." : "the interval sits on zero: probably nothing there.") : "the interval excludes zero: something may be there, smaller than a half can see."}`,
    });
    agents.push({ agent: "confounder", angle: covariateWords(c), said: ch.confounder.said });
    agents.push({ agent: "composition", angle: "cell mix", said: ch.composition.said });
    agents.push({ agent: "skeptic", angle: "robustness", said: ch.skeptic.said });
  }
  return finishCase(receipt, exp, agents, proposals, c, second, values);
}

function finishCase(receipt: number, exp: Experiment, agents: AgentNote[], proposals: Proposal[], c: Cohort, second: Cohort, values: number[] | null): SwarmCase {
  const { gene, group, axis } = exp;
  const idx = everyone(c);
  const current = values ? axisStat(c, values, idx, axis) : null;

  // cell type analyst: the same gene and outcome in the other groups
  const others = GROUPS.filter((g) => g !== group && c.groups.includes(g))
    .map((g) => ({ g, v: c.expr(gene, g) }))
    .filter((x): x is { g: Group; v: number[] } => !!x.v)
    .map((x) => ({ ...x, st: axisStat(c, x.v, idx, axis) }))
    .sort((a, b) => Math.abs(b.st.effect) - Math.abs(a.st.effect));
  const bestCell = others.find((o) => o.st.p < 0.01 && Math.abs(o.st.effect) > Math.abs(current?.effect ?? 0));
  agents.push({
    agent: "cell type", angle: "other cell groups",
    said: bestCell ? `strongest in ${bestCell.g}: ${s(bestCell.st)}${current ? ` vs ${fmtE(current.effect)} in ${group}` : ""}. proposing ${bestCell.g}.` : "no other cell group does better.",
  });

  // axis analyst: the same gene and group against the other pathology measures
  const axes = values
    ? c.axes.filter((a) => a !== axis).map((a) => ({ a, st: axisStat(c, values, idx, a) })).sort((x, y) => x.st.p - y.st.p)
    : [];
  const bestAxis = axes.find((x) => x.st.p < 0.01);
  agents.push({
    agent: "axis", angle: "other pathology measures",
    said: bestAxis ? `${bestAxis.a} beats ${axis} for ${gene} in ${group}: ${s(bestAxis.st)}. proposing ${bestAxis.a}.` : `no measure beats "${AXIS_LABEL[axis]}" for ${gene} in ${group}.`,
  });

  const propose = (g: Group, a: Axis, from: string, v: number[]) => {
    const ch = challenges(c, gene, g, a, v);
    proposals.push({
      gene, group: g, axis: a, from, effect: ch.base.effect, p: ch.base.p,
      challenge: { confounder: ch.confounder, composition: ch.composition, skeptic: ch.skeptic },
      survives: ch.confounder.ok && ch.composition.ok && ch.skeptic.ok,
    });
  };
  if (bestCell) propose(bestCell.g, axis, "cell type", bestCell.v);
  if (bestAxis && values) propose(group, bestAxis.a, "axis", values);

  // survivors are sealed and tested on the second region, corrected for every follow-up so far
  const followups: Followup[] = [];
  for (const p of proposals.filter((x) => x.survives)) {
    const registration = hashOf({ axis: p.axis, cohort: second.id, gene, group: p.group, kind: "followup", protocol: PROTOCOL });
    const prior = one<{ result: string; passed: number; same_sign: number }>("select result, passed, same_sign from followups where registration = ?", registration);
    if (prior) {
      const r = json<{ alpha: number }>(prior.result, { alpha: ALPHA });
      followups.push({ registration, prediction: `${gene} · ${p.group} · ${p.axis}`, test: `${second.region}`, passed: !!prior.passed, same_sign: !!prior.same_sign, alpha: r.alpha, reused: true });
      continue;
    }
    const n = (one<{ n: number }>("select count(*) as n from followups")?.n ?? 0) + 1;
    const alpha = ALPHA / n;
    const v2 = second.expr(gene, p.group);
    const st = v2 ? confirmStat(second, v2, p.axis) : null;
    const same = !!st && Math.sign(st.effect) === Math.sign(p.effect);
    const passed = !!st && same && st.p < alpha;
    run(
      "insert into followups (registration, case_receipt, gene, grp, axis, at, region, result, passed, same_sign) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      registration, receipt, gene, p.group, p.axis, nowIso(), second.region, JSON.stringify({ ...(st ?? {}), alpha }), passed ? 1 : 0, same ? 1 : 0,
    );
    followups.push({
      registration, prediction: `${gene} · ${p.group} · ${p.axis}`,
      test: st ? `${second.region}${st.proxy ? ` (${st.proxy})` : ""} ${fmtE(st.effect)} p ${fmtP(st.p)} (needs p < ${fmtP(alpha)})` : `${second.region}: ${v2 ? "no way to test this outcome there" : "not measured"}`,
      passed, same_sign: same, alpha,
    });
  }

  const outcome = !proposals.length
    ? "case closed: nothing better to follow up."
    : !followups.length
      ? "case closed: every proposal failed a challenge."
      : followups.some((f) => f.passed)
        ? `follow-up confirmed in ${second.region}.`
        : `follow-up registered; not confirmed in ${second.region}.`;
  const sc: SwarmCase = { receipt, gene, group, axis, opened: nowIso(), agents, proposals, outcome, followups };
  run(
    "insert into swarm_cases (receipt, gene, grp, axis, opened, data) values (?, ?, ?, ?, ?, ?) on conflict(receipt) do nothing",
    receipt, gene, group, axis, sc.opened, JSON.stringify(sc),
  );
  return sc;
}

export function listCases(limit = 20, gene?: string): SwarmCase[] {
  const rows = gene
    ? all<{ data: string }>("select data from swarm_cases where gene = ? order by receipt desc limit ?", gene, limit)
    : all<{ data: string }>("select data from swarm_cases order by receipt desc limit ?", limit);
  return rows.map((r) => JSON.parse(r.data) as SwarmCase);
}

export function swarmStats() {
  const cases = one<{ n: number }>("select count(*) as n from swarm_cases")?.n ?? 0;
  const f = one<{ n: number; same: number; ok: number }>("select count(*) as n, sum(same_sign) as same, sum(passed) as ok from followups");
  return { count: cases, followups: f?.n ?? 0, same_sign: f?.same ?? 0, confirmed: f?.ok ?? 0 };
}
