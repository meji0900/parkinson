// Sealed studies: a question about a set of Parkinson's genes, written down and hashed before any data
// is read, then run once from the agent's own queue. The score is each donor's mean z-scored expression
// of the genes in one cell group. The rule, sealed with the question: the score moves the expected way
// in both donor halves (p < 0.05 each), and beats 95% of random gene sets of the same size and
// expression level. A study that misses its rule prints a receipt like any other failure.
import { addReceipt } from "@/lib/agent/receipts";
import { json, nowIso, one, run, all } from "@/lib/server/db";
import type { AgentEvent } from "@/lib/server/events";
import { hashOf } from "@/lib/server/hash";
import { sleep } from "@/lib/server/http";
import { AXIS_LABEL, cohorts, RESILIENCE_STAGE, seeded, type Axis, type Cohort, type Group } from "./cohort";
import { ALPHA, axisStat, everyone, halves, PROTOCOL } from "./experiments";
import { fmtE, fmtP, mean, ranks, type Stat } from "./stats";

export type StudyDef = {
  id: string;
  short: string;
  title: string;
  question: string;
  why: string;
  genes: string[];
  group: Group;
  axis: Axis;
  /** the sign the score must take: -1 falls, +1 rises, 0 either way as long as both halves agree */
  direction: -1 | 0 | 1;
};

export const RANDOM_SETS = 1000;

export const STUDIES: StudyDef[] = [
  {
    id: "lysosome",
    short: "the lysosome program",
    title: "The lysosomal axis in dopamine neurons",
    question: "Does a score built from the lysosomal Parkinson's genes fall as Lewy pathology advances, inside dopamine neurons?",
    why: "Variants in GBA1, which encodes the lysosomal enzyme glucocerebrosidase, are the most common genetic risk factor for Parkinson's. LRRK2 and VPS35 mutations disturb traffic to the lysosome, TMEM175 is a lysosomal ion channel at a risk locus, and ATP13A2 and VPS13C cause rare early-onset forms. If the lysosome is where these genes meet, the programme should weaken in the neurons that carry Lewy bodies.",
    genes: ["GBA1", "LRRK2", "TMEM175", "VPS35", "SCARB2", "CTSB", "GALC", "ATP13A2", "VPS13C", "GPNMB", "RAB29", "RAB32"],
    group: "dopamine neurons",
    axis: "braak",
    direction: -1,
  },
  {
    id: "identity",
    short: "dopamine identity",
    title: "Do surviving dopamine neurons lose their identity?",
    question: "Does the dopamine identity programme fall with nigral neuron loss, inside the dopamine neurons that are left?",
    why: "Kamath et al. (2022) found that one population of nigral dopamine neurons, marked by SOX6 and AGTR1, is the most depleted in Parkinson's. These genes make a dopamine neuron what it is: dopamine synthesis (TH, DDC), packaging and reuptake (SLC18A2, SLC6A3) and the transcription factors that keep the identity on (NR4A2, FOXA2, LMX1B). If identity erodes before death, the survivors should show it.",
    genes: ["TH", "SLC6A3", "SLC18A2", "DDC", "KCNJ6", "ALDH1A1", "NR4A2", "FOXA2", "LMX1B", "SOX6", "AGTR1", "RET"],
    group: "dopamine neurons",
    axis: "nigra",
    direction: -1,
  },
  {
    id: "mitophagy",
    short: "mitochondrial quality control",
    title: "Mitochondrial quality control and Lewy stage",
    question: "Does the mitochondrial quality-control programme move with Lewy stage in dopamine neurons, the same way in both halves?",
    why: "PINK1 and parkin (PRKN) mark damaged mitochondria for removal, and losing either causes early-onset recessive Parkinson's. PARK7 (DJ-1), CHCHD2 and FBXO7 are other mitochondrial Parkinson's genes, and USP30 opposes parkin's tagging. The direction is not sealed: a cell under stress could raise the programme or lose it.",
    genes: ["PINK1", "PRKN", "PARK7", "CHCHD2", "FBXO7", "VDAC1", "MFN2", "OPA1", "TOMM20", "USP30"],
    group: "dopamine neurons",
    axis: "braak",
    direction: 0,
  },
  {
    id: "microglia",
    short: "the microglial response",
    title: "An antigen-presenting microglial response",
    question: "Does the antigen-presenting, phagocytic microglial programme rise with Lewy stage?",
    why: "HLA-DRA sits at a Parkinson's risk locus, and microglia carrying HLA-DR were found in the substantia nigra of people with Parkinson's as early as 1988 (McGeer et al.). GPNMB is both a risk gene and a marker of lipid-laden phagocytes.",
    genes: ["HLA-DRA", "HLA-DRB1", "CD74", "GPNMB", "LGALS3", "TREM2", "APOE", "SPP1", "CD68", "CTSD"],
    group: "microglia",
    axis: "braak",
    direction: 1,
  },
  {
    id: "synapse",
    short: "the synaptic vesicle cycle",
    title: "The synaptic vesicle cycle in resilient donors",
    question: "Do dopamine neurons from resilient donors, with Lewy pathology but no parkinsonism, keep a different level of the synaptic-vesicle machinery?",
    why: "α-Synuclein (SNCA) is a presynaptic protein. SYNJ1, DNAJC6 and SH3GL2 work on synaptic-vesicle recycling and are tied to Parkinson's by genetics. If resilience is about keeping release going, this is where it would show.",
    genes: ["SNCA", "SYNJ1", "DNAJC6", "SH3GL2", "SV2C", "SYT11", "RAB3B", "CPLX1", "SNAP25", "STX1A"],
    group: "dopamine neurons",
    axis: "resilience",
    direction: 0,
  },
];

export const studyDef = (id: string) => STUDIES.find((s) => s.id === id) ?? null;

export type StudyResult = {
  used: string[];
  missing: string[];
  discovery: Stat;
  replication: Stat;
  full: Stat;
  random: { n: number; beaten: number; p: number; hist: number[]; lo: number; hi: number };
  per_gene: { gene: string; effect: number; p: number }[];
  passed: boolean;
  reason: string;
};

export type Study = {
  id: string;
  registration: string;
  at: string;
  cohort: string;
  state: "sealed" | "done";
  def: StudyDef;
  result: StudyResult | null;
  receipt: number | null;
};

type Row = { id: string; registration: string; at: string; cohort: string; state: "sealed" | "done"; def: string; result: string | null; receipt: number | null };
const toStudy = (r: Row): Study => ({ ...r, def: json<StudyDef>(r.def, null as never), result: json<StudyResult | null>(r.result, null) });

/** the study as sealed on the cohort in use (a new cohort gets its own registration) */
export const getStudy = (id: string) => {
  const r = one<Row>("select * from studies where id = ? and cohort = ?", id, cohorts().primary.id);
  return r ? toStudy(r) : null;
};
export const listStudies = () => all<Row>("select * from studies where cohort = ? order by at", cohorts().primary.id).map(toStudy);

/** the next study in the queue that has not been sealed on this cohort yet */
export function nextStudy(): StudyDef | null {
  const { primary } = cohorts();
  return STUDIES.find((s) => !one("select 1 from studies where id = ? and cohort = ?", s.id, primary.id)) ?? null;
}

export const registrationOfStudy = (d: StudyDef, cohortId: string) =>
  hashOf({ axis: d.axis, cohort: cohortId, direction: d.direction, genes: [...d.genes].sort(), group: d.group, id: d.id, kind: "study", protocol: PROTOCOL, random_sets: RANDOM_SETS });

// ---------------------------------------------------------------- the score
const zs = (x: number[]) => {
  const m = mean(x);
  const s = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length) || 1;
  return x.map((v) => (v - m) / s);
};

export function setScore(c: Cohort, genes: string[], group: Group): { values: number[] | null; used: string[] } {
  const used: string[] = [];
  const sum = new Array<number>(c.donors.length).fill(0);
  for (const g of genes) {
    const v = c.expr(g, group);
    if (!v) continue;
    used.push(g);
    zs(v).forEach((x, i) => (sum[i] += x));
  }
  return used.length ? { values: sum.map((x) => x / used.length), used } : { values: null, used };
}

/** random gene sets matched on expression level: each study gene is swapped for a background gene from the same decile */
function randomSets(c: Cohort, used: string[], group: Group, registration: string) {
  const bg = c.background(group).filter((g) => !used.includes(g));
  const level = (g: string) => { const v = c.expr(g, group); return v ? mean(v) : NaN; };
  const pool = bg.map((g) => [g, level(g)] as const).filter(([, l]) => Number.isFinite(l)).sort((a, b) => a[1] - b[1]);
  if (pool.length < used.length * 5) return [];
  const deciles = Array.from({ length: 10 }, (_, d) => pool.slice(Math.floor((d * pool.length) / 10), Math.floor(((d + 1) * pool.length) / 10)).map(([g]) => g));
  const decileOf = (l: number) => {
    let k = pool.findIndex(([, x]) => x >= l);
    if (k < 0) k = pool.length - 1;
    return Math.min(9, Math.floor((k * 10) / pool.length));
  };
  const targets = used.map((g) => decileOf(level(g)));
  const r = seeded("random-sets:" + registration);
  return Array.from({ length: RANDOM_SETS }, () => targets.map((d) => deciles[d][Math.floor(r() * deciles[d].length)]));
}

const effectOf = (c: Cohort, v: number[], axis: Axis) => axisStat(c, v, everyone(c), axis).effect;

export function computeStudy(d: StudyDef, registration: string): StudyResult {
  const { primary: c } = cohorts();
  const { values, used } = setScore(c, d.genes, d.group);
  const missing = d.genes.filter((g) => !used.includes(g));
  const none: Stat = { effect: 0, p: 1, n: 0, stat: "n/a" };
  if (!values || used.length < 3) {
    return {
      used, missing, discovery: none, replication: none, full: none, random: { n: 0, beaten: 0, p: 1, hist: [], lo: 0, hi: 0 }, per_gene: [],
      passed: false, reason: `only ${used.length} of ${d.genes.length} genes are measured in ${d.group}; the study cannot run`,
    };
  }
  const [a, b] = halves(registration, c.donors.length);
  const discovery = axisStat(c, values, a, d.axis);
  const replication = axisStat(c, values, b, d.axis);
  const full = axisStat(c, values, everyone(c), d.axis);
  const per_gene = used.map((g) => { const s = axisStat(c, c.expr(g, d.group)!, everyone(c), d.axis); return { gene: g, effect: s.effect, p: s.p }; });

  // random gene sets of the same size and expression level, scored the same way
  const sets = randomSets(c, used, d.group, registration);
  const nulls = sets.map((genes) => { const s = setScore(c, genes, d.group); return s.values ? effectOf(c, s.values, d.axis) : 0; });
  const dir = d.direction || Math.sign(full.effect) || 1;
  const beaten = nulls.filter((e) => (d.direction ? e * dir < full.effect * dir : Math.abs(e) < Math.abs(full.effect))).length;
  const lo = Math.min(-0.6, ...nulls, full.effect), hi = Math.max(0.6, ...nulls, full.effect);
  const hist = new Array<number>(24).fill(0);
  for (const e of nulls) hist[Math.min(23, Math.floor(((e - lo) / (hi - lo)) * 24))]++;
  const randomP = sets.length ? (1 + sets.length - beaten) / (1 + sets.length) : 1;

  const sameSign = Math.sign(discovery.effect) === Math.sign(replication.effect);
  const rightWay = !d.direction || Math.sign(discovery.effect) === d.direction;
  const halvesOk = discovery.p < ALPHA && replication.p < ALPHA && sameSign && rightWay;
  const passed = halvesOk && sets.length > 0 && randomP < 0.05;
  const reason = passed
    ? `held: ${fmtE(discovery.effect)} then ${fmtE(replication.effect)}, beyond ${beaten} of ${sets.length} random sets`
    : !rightWay && discovery.p < ALPHA
      ? `went the wrong way: sealed ${d.direction < 0 ? "a fall" : "a rise"}, got ${fmtE(discovery.effect)} (p ${fmtP(discovery.p)})`
      : discovery.p >= ALPHA
        ? `no effect in the discovery half (${fmtE(discovery.effect)}, p ${fmtP(discovery.p)})`
        : !halvesOk
          ? `did not replicate (discovery ${fmtE(discovery.effect)} p ${fmtP(discovery.p)}; held-out ${fmtE(replication.effect)} p ${fmtP(replication.p)})`
          : sets.length
            ? `held in both halves but beat only ${beaten} of ${sets.length} random sets (needs 95%)`
            : "held in both halves, but there were too few background genes to build random sets";
  return { used, missing, discovery, replication, full, random: { n: sets.length, beaten, p: randomP, hist, lo, hi }, per_gene, passed, reason };
}

// ---------------------------------------------------------------- seal, then run, in public
type RunOpts = { emit?: (e: AgentEvent) => unknown; pace?: number };

export function sealStudy(id: string): Study {
  const d = studyDef(id);
  if (!d) throw new Error("unknown study");
  const { primary } = cohorts();
  const existing = getStudy(id);
  if (existing) return existing;
  const registration = registrationOfStudy(d, primary.id);
  run("insert into studies (registration, id, at, cohort, state, def) values (?, ?, ?, ?, 'sealed', ?) on conflict(registration) do nothing",
    registration, id, nowIso(), primary.id, JSON.stringify(d));
  return getStudy(id)!;
}

export async function runStudy(id: string, opts: RunOpts = {}): Promise<Study> {
  const say = async (x: string, extra: Record<string, unknown> = {}) => {
    await opts.emit?.({ gene: null, k: "study", x, ...extra });
    if (opts.pace) await sleep(opts.pace);
  };
  const st = sealStudy(id);
  if (st.state === "done") return st;
  const d = st.def;
  const { primary } = cohorts();
  await say(`study: ${d.title.toLowerCase()}. ${d.genes.length} genes in ${d.group}, ${AXIS_LABEL[d.axis]}.`, { lead: true });
  await say(`sealed ${st.registration.slice(0, 16)} before reading any expression: ${d.direction ? (d.direction < 0 ? "must fall" : "must rise") : "either way"}, p < 0.05 in both halves, beyond 95% of ${RANDOM_SETS} matched random sets.`);
  const r = computeStudy(d, st.registration);
  await say(`${r.used.length} of ${d.genes.length} genes measured${r.missing.length ? ` (missing: ${r.missing.join(", ")})` : ""}. discovery ${fmtE(r.discovery.effect)} (p ${fmtP(r.discovery.p)}) → held-out ${fmtE(r.replication.effect)} (p ${fmtP(r.replication.p)}).`);
  if (r.random.n) await say(`all ${primary.donors.length} donors ${fmtE(r.full.effect)}; beats ${r.random.beaten} of ${r.random.n} random sets.`);
  let receipt: number | null = null;
  if (!r.passed) {
    receipt = addReceipt({
      kind: "study", subject: d.short, group: d.group, axis: d.axis, why: r.reason, registration: st.registration, source: primary.label,
      tried: [
        { reader: "study", result: d.title },
        { reader: "registered", result: st.registration.slice(0, 16) },
        { reader: "discovery", score: `${fmtE(r.discovery.effect)} p=${fmtP(r.discovery.p)}` },
        { reader: "replication", score: `${fmtE(r.replication.effect)} p=${fmtP(r.replication.p)}` },
        { reader: "random sets", score: r.random.n ? `${r.random.beaten}/${r.random.n}` : "n/a" },
      ],
    }).no;
  }
  run("update studies set state = 'done', result = ?, receipt = ? where registration = ?", JSON.stringify(r), receipt, st.registration);
  await say(r.passed ? `study held: ${r.reason}.` : `${r.reason}. receipt ${String(receipt).padStart(4, "0")}.`, r.passed ? { pass: true } : { receipt });
  return getStudy(id)!;
}

// ---------------------------------------------------------------- the permutation test other agents can compute
// The study's full-sample statistic, in integers so every language gets the same answer: a = 2 x ranks of the
// score, b = 2 x ranks of the outcome (or 1/0 resilient for the resilience test). D = |n * sum(a_i b_i) - sum(a) sum(b)|.
export function permutationInput(id: string): { a: number[]; b: number[]; observed: number } | null {
  const st = getStudy(id);
  if (!st || st.state !== "done") return null;
  const { primary: c } = cohorts();
  const { values } = setScore(c, st.def.genes, st.def.group);
  if (!values) return null;
  let idx = everyone(c);
  let outcome: number[];
  if (st.def.axis === "resilience") {
    idx = idx.filter((i) => c.donors[i].braak >= RESILIENCE_STAGE);
    outcome = idx.map((i) => (c.donors[i].parkinsonism ? 0 : 1));
  } else {
    const ax = st.def.axis;
    outcome = ranks(idx.map((i) => c.donors[i][ax])).map((x) => x * 2);
  }
  const a = ranks(idx.map((i) => values[i])).map((x) => Math.round(x * 2));
  const b = outcome.map((x) => Math.round(x));
  return { a, b, observed: deviation(a, b) };
}

export function deviation(a: number[], b: number[]): number {
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; sa += a[i]; sb += b[i]; }
  return Math.abs(a.length * s - sa * sb);
}
