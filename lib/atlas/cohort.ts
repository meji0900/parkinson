// The atlas the predictions are tested on.
//
// Real data: put a donor table and per-cell-group pseudobulk matrices under data/atlas/<cohort>/
// (scripts/build_pseudobulk.py builds them from a substantia nigra single-nucleus h5ad) and they are used.
// Without them the agent runs on a SIMULATED cohort shaped like the published midbrain atlases: the same
// cell groups, Lewy-body staging, nigral neuron loss and clinical parkinsonism. Every record made on it is
// labelled simulated; none of it is a finding.
import fs from "node:fs";
import path from "node:path";

export const GROUPS = [
  "dopamine neurons", "GABA neurons", "glutamate neurons", "microglia", "astrocytes", "oligodendrocytes", "OPCs", "endothelial",
] as const;
export type Group = (typeof GROUPS)[number];

export const AXES = ["braak", "nigra", "resilience"] as const;
export type Axis = (typeof AXES)[number];
export const AXIS_LABEL: Record<Axis, string> = {
  braak: "tracks Braak Lewy-body stage",
  nigra: "tracks nigral neuron loss",
  resilience: "differs in resilient donors (Lewy pathology, no parkinsonism)",
};
export const AXIS_SHORT: Record<Axis, string> = { braak: "Lewy stage", nigra: "nigral loss", resilience: "resilience" };

/** donors at or above this Braak Lewy-body stage count as carrying heavy pathology for the resilience test */
export const RESILIENCE_STAGE = 3;

export type Donor = {
  id: string;
  age: number;
  female: number;
  pmi: number;
  /** Braak Lewy-body stage, 0 to 6 */
  braak: number;
  /** semi-quantitative loss of pigmented neurons in the substantia nigra, 0 (none) to 3 (severe) */
  nigra: number;
  /** clinical parkinsonism in life (a PD or PD-dementia diagnosis) */
  parkinsonism: number;
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
  /** genes to draw matched random sets from, for the studies */
  background(group: Group): string[];
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
    const L = clamp(r() ** 0.8, 0, 1); // Lewy burden
    const R = gauss(r); // unmeasured resilience
    const braak = Math.round(clamp(L * 6 + gauss(r) * 0.6, 0, 6));
    // neurons are lost after Lewy pathology reaches the nigra, so loss lags the stage
    const nigra = Math.round(clamp(3 * L ** 1.4 + gauss(r) * 0.45, 0, 3));
    const parkinsonism = r() < 1 / (1 + Math.exp(-(-2.6 + 6 * L - 1.0 * R))) ? 1 : 0;
    const raw: Record<Group, number> = {
      // the pigmented neurons are the ones that die: their share falls by about two thirds at the end
      "dopamine neurons": clamp(0.05 - 0.034 * L + gauss(r) * 0.007, 0.004, 0.09),
      "GABA neurons": clamp(0.045 - 0.006 * L + gauss(r) * 0.006, 0.015, 0.08),
      "glutamate neurons": clamp(0.03 - 0.004 * L + gauss(r) * 0.005, 0.01, 0.06),
      microglia: clamp(0.07 + 0.03 * L + gauss(r) * 0.012, 0.03, 0.15),
      astrocytes: clamp(0.11 + 0.025 * L + gauss(r) * 0.015, 0.05, 0.2),
      oligodendrocytes: clamp(0.56 + gauss(r) * 0.05, 0.35, 0.72),
      OPCs: clamp(0.07 + gauss(r) * 0.01, 0.03, 0.11),
      endothelial: clamp(0.03 + gauss(r) * 0.006, 0.01, 0.06),
    };
    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    const share = Object.fromEntries(GROUPS.map((g) => [g, raw[g] / sum])) as Record<Group, number>;
    donors.push({
      id: `D${String(i + 1).padStart(3, "0")}`,
      age: Math.round(clamp(76 + r() * 20 + gauss(r) * 3, 55, 99)),
      female: r() < 0.38 ? 1 : 0, // Parkinson's is more common in men
      pmi: Math.round((3 + r() * 14) * 10) / 10,
      braak, nigra, parkinsonism, share,
    });
    latent.push({ L, R });
  }
  return { donors, latent };
}

type GeneParams = { measured: boolean; mu: number; beta: number; gamma: number; comp: number; age: number; sex: number; loss: number };

// Genes that every nigral single-nucleus dataset detects in dopamine neurons and glia: the Parkinson's genes and
// the dopamine identity genes. The simulation never drops them, so it cannot report SNCA as unmeasured.
const ALWAYS_MEASURED = new Set([
  "SNCA", "LRRK2", "GBA1", "PRKN", "PINK1", "PARK7", "VPS35", "MAPT", "GCH1", "TMEM175", "CTSB", "GALC", "SCARB2", "ATP13A2",
  "VPS13C", "GPNMB", "RAB29", "RAB32", "SYNJ1", "DNAJC6", "SH3GL2", "FBXO7", "CHCHD2", "VDAC1", "MFN2", "OPA1", "TOMM20", "USP30",
  "TH", "SLC6A3", "SLC18A2", "DDC", "KCNJ6", "ALDH1A1", "NR4A2", "FOXA2", "LMX1B", "SOX6", "AGTR1", "RET", "SV2C", "SYT11", "RAB3B",
  "CPLX1", "SNAP25", "STX1A", "HLA-DRA", "HLA-DRB1", "CD74", "LGALS3", "TREM2", "APOE", "SPP1", "CD68", "CTSD", "RIT2", "PLA2G6",
]);

function geneParams(gene: string, group: Group): GeneParams {
  const r = seeded(`params:${gene}:${group}`);
  const da = group === "dopamine neurons";
  const neuron = group.includes("neurons");
  // dopamine neurons are a few percent of nigral nuclei, so more genes drop out there
  const measured = r() < (da ? 0.86 : neuron ? 0.9 : 0.85) || ALWAYS_MEASURED.has(gene.toUpperCase());
  const beta = r() < 0.08 ? (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.4) : 0; // true Lewy-stage effect
  const gamma = r() < 0.05 ? (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.5) : 0; // true resilience effect
  const comp = neuron && r() < (da ? 0.2 : 0.12) ? (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.5) : 0; // cell-mix artefact
  const loss = r() < 0.04 ? (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.3) : 0; // tracks neuron loss beyond the stage
  return { measured, mu: 1 + r() * 3, beta, gamma, comp, age: gauss(r) * 0.1, sex: gauss(r) * 0.1, loss };
}

const SIM_BACKGROUND = Array.from({ length: 1600 }, (_, i) => `SIMG${String(i + 1).padStart(4, "0")}`);

function simulatedCohort(id: string, label: string, region: string, seed: string, n: number, attenuation: number): Cohort {
  const { donors, latent } = simulateDonors(seed, n);
  const zL = z(latent.map((l) => l.L)), zR = latent.map((l) => l.R), zAge = z(donors.map((d) => d.age));
  const zLossResid = z(donors.map((d, i) => d.nigra - 3 * latent[i].L ** 1.4));
  const cache = new Map<string, number[] | null>();
  return {
    id, label, region, simulated: true, donors, cells: n * 9000, genes: null,
    expr(gene, group) {
      const key = gene + "|" + group;
      if (cache.has(key)) return cache.get(key)!;
      const p = geneParams(gene, group);
      if (!p.measured) { cache.set(key, null); return null; }
      const zShare = z(donors.map((d) => d.share[group]));
      const noise = seeded(`noise:${seed}:${gene}:${group}`);
      const v = donors.map((d, i) =>
        p.mu + attenuation * (p.beta * zL[i] + p.gamma * zR[i] + p.loss * zLossResid[i]) + p.comp * zShare[i] +
        p.age * zAge[i] + p.sex * d.female + gauss(noise) * 0.9);
      if (cache.size > 6000) cache.clear();
      cache.set(key, v);
      return v;
    },
    background: () => SIM_BACKGROUND,
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
    background(group) {
      return [...(load(group)?.keys() ?? [])];
    },
  };
}

// ---------------------------------------------------------------- the two cohorts in use
const g = globalThis as unknown as { __jamesCohorts?: { primary: Cohort; second: Cohort } };

export function cohorts(): { primary: Cohort; second: Cohort } {
  if (g.__jamesCohorts) return g.__jamesCohorts;
  const root = process.env.ATLAS_DIR ?? path.join(process.cwd(), "data", "atlas");
  const primary =
    diskCohort(path.join(/*turbopackIgnore: true*/ root, process.env.ATLAS_PRIMARY ?? "pd-snpc")) ??
    simulatedCohort("sim-snpc-v2", "simulated substantia nigra cohort (84 donors)", "substantia nigra pars compacta", "james-sim-snpc-v1", 84, 1);
  const second =
    diskCohort(path.join(/*turbopackIgnore: true*/ root, process.env.ATLAS_SECOND ?? "pd-vta")) ??
    simulatedCohort("sim-vta-v2", "simulated ventral tegmental area cohort (80 donors)", "ventral tegmental area", "james-sim-vta-v1", 80, 0.75);
  g.__jamesCohorts = { primary, second };
  return g.__jamesCohorts;
}

export const isGroup = (s: string): s is Group => (GROUPS as readonly string[]).includes(s);
export const isAxis = (s: string): s is Axis => (AXES as readonly string[]).includes(s);
