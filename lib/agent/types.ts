export type Facet = "genetics" | "cell" | "chem" | "clinic" | "lit" | "path";
export const FACETS: Facet[] = ["genetics", "cell", "chem", "clinic", "lit", "path"];

export const FACET_LABEL: Record<Facet, string> = {
  genetics: "genetics",
  cell: "cell type",
  chem: "chemistry",
  clinic: "trials",
  lit: "literature",
  path: "pathways",
};

export const SOURCE: Record<Facet, string> = {
  genetics: "Open Targets",
  cell: "Human Protein Atlas",
  chem: "Open Targets",
  clinic: "ClinicalTrials.gov",
  lit: "PubMed",
  path: "Reactome",
};

// How much each reader counts toward the translation score.
export const WEIGHTS: Record<Facet, number> = {
  genetics: 0.3,
  lit: 0.2,
  cell: 0.15,
  path: 0.13,
  chem: 0.12,
  clinic: 0.1,
};
export const THRESHOLD = 0.55;

export type Level = "strong" | "moderate" | "weak" | "absent";
export const level = (s: number): Level => (s >= 0.75 ? "strong" : s >= 0.45 ? "moderate" : s > 0.05 ? "weak" : "absent");

export type CellKind = "neuron" | "microglia" | "astrocyte" | "oligodendrocyte" | "OPC" | "none";

export type Finding = {
  facet: Facet;
  ok: boolean;
  score: number;
  level: Level;
  summary: string;
  detail: Record<string, unknown>;
  error?: string;
};

export type GeneRef = { symbol: string; ensg: string; name: string };

export type Hypothesis = {
  score: number;
  statement: string;
  direction: "both";
  direction_why: string;
  cell: string;
  cell_kind: CellKind;
  theme: string;
  molecular: string;
  functional: string;
  falsifier: string;
  lab_ask: string;
  scores: Record<Facet, number>;
  dissent: Facet[];
};

export type RunRecord = {
  symbol: string;
  ensg: string;
  name: string;
  at: string;
  findings: Record<Facet, Finding>;
  score: number;
  passed: boolean;
  merge: { sha: string; recovered: Record<Facet, { cos: number; next: number; ok: boolean }> };
  hypothesis?: Hypothesis;
  receipt?: number;
  elapsed: number;
};
