// The atlas the predictions are tested on.
//
// Real data: put a donor table and per-cell-group pseudobulk matrices under data/atlas/<cohort>/
// (scripts/build_pseudobulk.py builds them from the SEA-AD h5ad files) and they are used.
// Without them the agent runs on a SIMULATED cohort shaped like SEA-AD (84 donors, the same cell
// groups and staging). Every record made on it is labelled simulated; none of it is a finding.
import fs from "node:fs";
import path from "node:path";

export const GROUPS = [
  "microglia", "astrocytes", "oligodendrocytes", "OPCs", "endothelial", "VLMC", "excitatory neurons", "inhibitory neurons",
] as const;
export type Group = (typeof GROUPS)[number];

export const AXES = ["braak", "thal", "resilience"] as const;
export type Axis = (typeof AXES)[number];
export const AXIS_LABEL: Record<Axis, string> = {
  braak: "tracks Braak (tau) stage",
  thal: "tracks Thal (amyloid) phase",
  resilience: "differs in resilient donors (high pathology, no dementia)",
};

export type Donor = {
  id: string;
  age: number;
  female: number;
  pmi: number;
  braak: number;
  thal: number;
  cerad: number;
  dementia: number;
  share: Record<Group, number>;
};

export type Cohort = {
  id: string;
  label: string;
  region: string;
  simulated: boolean;
  donors: Donor[];
  cells: number;
  genes: number | null;
  /** donor-ordered expression of a gene in a group, or null when the group does not measure it */
  expr(gene: string, group: Group): number[] | null;
};

// ---------------------------------------------------------------- seeded randomness
function seeded(name: string) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { seeded };
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const z = (x: number[]) => {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  const s = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length) || 1;
  return x.map((v) => (v - m) / s);
};

// ---------------------------------------------------------------- simulated cohort
type Latent = { L: number; R: number };

function simulateDonors(seed: string, n: number): { donors: Donor[]; latent: Latent[] } {
  const r = seeded(seed);
  const donors: Donor[] = [], latent: Latent[] = [];
  for (let i = 0; i < n; i++) {
    const L = clamp(r() ** 0.8, 0, 1); // pathology burden
    const R = gauss(r); // unmeasured resilience
    const braak = Math.round(clamp(L * 6 + gauss(r) * 0.6, 0, 6));
    const thal = Math.round(clamp(L * 5 + gauss(r) * 0.8, 0, 5));
    const cerad = Math.round(clamp(L * 3 + gauss(r) * 0.5, 0, 3));
    const dementia = r() < 1 / (1 + Math.exp(-(-2.4 + 5.6 * L - 0.9 * R))) ? 1 : 0;
    const raw: Record<Group, number> = {
      "excitatory neurons": clamp(0.34 - 0.09 * L + gauss(r) * 0.03, 0.12, 0.5),
      "inhibitory neurons": clamp(0.13 - 0.02 * L + gauss(r) * 0.015, 0.05, 0.2),
      microglia: clamp(0.05 + 0.025 * L + gauss(r) * 0.01, 0.02, 0.12),
      astrocytes: clamp(0.1 + 0.03 * L + gauss(r) * 0.015, 0.04, 0.2),
      oligodendrocytes: clamp(0.27 + gauss(r) * 0.04, 0.1, 0.45),
      OPCs: clamp(0.06 + gauss(r) * 0.01, 0.02, 0.1),
      endothelial: clamp(0.02 + gauss(r) * 0.005, 0.005, 0.05),
      VLMC: clamp(0.01 + gauss(r) * 0.003, 0.002, 0.03),
    };
    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    const share = Object.fromEntries(GROUPS.map((g) => [g, raw[g] / sum])) as Record<Group, number>;
    donors.push({
      id: `D${String(i + 1).padStart(3, "0")}`,
      age: Math.round(clamp(78 + r() * 22, 65, 102)),
      female: r() < 0.56 ? 1 : 0,
      pmi: Math.round((3 + r() * 9) * 10) / 10,
      braak, thal, cerad, dementia, share,
    });
    latent.push({ L, R });
  }
  return { donors, latent };
}

type GeneParams = { measured: boolean; mu: number; beta: number; gamma: number; comp: number; age: number; sex: number; amyloid: number };

function geneParams(gene: string, group: Group): GeneParams {
  const r = seeded(`params:${gene}:${group}`);
  const neuron = group.includes("neurons");
  const measured = r() < (neuron ? 0.93 : 0.85);
  const beta = r() < 0.08 ? (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.4) : 0; // true tau-stage effect
  const gamma = r() < 0.05 ? (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.5) : 0; // true resilience effect
  const comp = neuron && r() < 0.12 ? (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.5) : 0; // cell-mix artefact
  const amyloid = r() < 0.04 ? (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.3) : 0;
  return { measured, mu: 1 + r() * 3, beta, gamma, comp, age: gauss(r) * 0.1, sex: gauss(r) * 0.1, amyloid };
}

function simulatedCohort(id: string, label: string, region: string, seed: string, n: number, attenuation: number): Cohort {
  const { donors, latent } = simulateDonors(seed, n);
  const zL = z(latent.map((l) => l.L)), zR = latent.map((l) => l.R), zAge = z(donors.map((d) => d.age));
  const zThalResid = z(donors.map((d, i) => d.thal - latent[i].L * 5));
  const cache = new Map<string, number[] | null>();
  return {
    id, label, region, simulated: true, donors, cells: n * 14000, genes: null,
    expr(gene, group) {
      const key = gene + "|" + group;
      if (cache.has(key)) return cache.get(key)!;
      const p = geneParams(gene, group);
      if (!p.measured) { cache.set(key, null); return null; }
      const zShare = z(donors.map((d) => d.share[group]));
      const noise = seeded(`noise:${seed}:${gene}:${group}`);
      const v = donors.map((d, i) =>
        p.mu + attenuation * (p.beta * zL[i] + p.gamma * zR[i] + p.amyloid * zThalResid[i]) + p.comp * zShare[i] +
        p.age * zAge[i] + p.sex * d.female + gauss(noise) * 0.9);
      if (cache.size > 4000) cache.clear();
      cache.set(key, v);
      return v;
    },
  };
}

// ---------------------------------------------------------------- real pseudobulk cohort from disk
type Meta = { id: string; label: string; region: string; cells: number; genes: number; donors: Donor[] };

function diskCohort(dir: string): Cohort | null {
  const metaFile = path.join(dir, "meta.json");
  if (!fs.existsSync(metaFile)) return null;
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as Meta;
  const groups = new Map<Group, Map<string, Float32Array> | null>();
  const load = (group: Group) => {
    if (groups.has(group)) return groups.get(group)!;
    const file = path.join(dir, `${group.replace(/\s+/g, "_")}.tsv`);
    if (!fs.existsSync(file)) { groups.set(group, null); return null; }
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const header = lines[0].split("\t").slice(1);
    const order = meta.donors.map((d) => header.indexOf(d.id));
    const m = new Map<string, Float32Array>();
    for (const line of lines.slice(1)) {
      if (!line) continue;
      const cells = line.split("\t");
      const v = new Float32Array(order.length);
      order.forEach((col, i) => (v[i] = col >= 0 ? Number(cells[col + 1]) : NaN));
      m.set(cells[0].toUpperCase(), v);
    }
    groups.set(group, m);
    return m;
  };
  return {
    id: meta.id, label: meta.label, region: meta.region, simulated: false, donors: meta.donors, cells: meta.cells, genes: meta.genes,
    expr(gene, group) {
      const v = load(group)?.get(gene.toUpperCase());
      return v && !v.some(Number.isNaN) ? Array.from(v) : null;
    },
  };
}

// ---------------------------------------------------------------- the two cohorts in use
const g = globalThis as unknown as { __engramCohorts?: { primary: Cohort; second: Cohort } };

export function cohorts(): { primary: Cohort; second: Cohort } {
  if (g.__engramCohorts) return g.__engramCohorts;
  const root = process.env.ATLAS_DIR ?? path.join(process.cwd(), "data", "atlas");
  const primary =
    diskCohort(path.join(/*turbopackIgnore: true*/ root, process.env.ATLAS_PRIMARY ?? "sea-ad-mtg")) ??
    simulatedCohort("sim-mtg-v1", "simulated temporal-cortex cohort (SEA-AD-shaped, 84 donors)", "middle temporal gyrus", "engram-sim-mtg-v1", 84, 1);
  const second =
    diskCohort(path.join(/*turbopackIgnore: true*/ root, process.env.ATLAS_SECOND ?? "sea-ad-pfc")) ??
    simulatedCohort("sim-pfc-v1", "simulated prefrontal cohort (80 donors)", "prefrontal cortex", "engram-sim-pfc-v1", 80, 0.8);
  g.__engramCohorts = { primary, second };
  return g.__engramCohorts;
}

export const isGroup = (s: string): s is Group => (GROUPS as readonly string[]).includes(s);
export const isAxis = (s: string): s is Axis => (AXES as readonly string[]).includes(s);
