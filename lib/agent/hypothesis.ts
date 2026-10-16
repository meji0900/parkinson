// The proposal. Readouts come from a fixed table keyed on cell type and pathway theme, so two runs on
// the same evidence write the same experiment. Direction is never guessed: both arms are requested.
import type { Group } from "@/lib/atlas/cohort";
import { FACETS, type CellKind, type Facet, type Finding, type Hypothesis } from "./types";

const CELL: Record<CellKind, { label: string; model: string; functional: string; group: Group }> = {
  neuron: {
    label: "dopamine neurons",
    model: "iPSC-derived midbrain dopamine neurons (FOXA2+, LMX1A+, TH+)",
    functional: "survival of TH-positive neurons and phospho-α-synuclein (pS129) inclusions after seeding with α-synuclein fibrils",
    group: "dopamine neurons",
  },
  microglia: {
    label: "microglia",
    model: "iPSC-derived microglia (iMGL)",
    functional: "uptake and clearance of α-synuclein fibrils and NLRP3 inflammasome activation (IL-1β release)",
    group: "microglia",
  },
  astrocyte: {
    label: "astrocytes",
    model: "iPSC-derived midbrain astrocytes",
    functional: "α-synuclein uptake and degradation, and dopamine neuron survival in co-culture",
    group: "astrocytes",
  },
  oligodendrocyte: {
    label: "oligodendrocytes",
    model: "iPSC-derived oligodendrocytes",
    functional: "α-synuclein uptake and myelin basic protein output under oxidative stress",
    group: "oligodendrocytes",
  },
  OPC: { label: "oligodendrocyte precursors", model: "iPSC-derived OPCs", functional: "differentiation into MBP-positive cells", group: "OPCs" },
  none: {
    label: "a dopamine neuron, astrocyte and microglia tri-culture",
    model: "a tri-culture of iPSC dopamine neurons, astrocytes and microglia",
    functional: "dopamine neuron survival after α-synuclein fibril challenge",
    group: "dopamine neurons",
  },
};

const THEME: Record<string, string> = {
  "mitochondrial quality control": "PINK1–parkin mitophagy flux (mt-Keima) and phospho-ubiquitin (pS65-Ub)",
  "lysosome and autophagy": "glucocerebrosidase (GCase) activity and LC3-II and p62 flux",
  "vesicle traffic": "LRRK2 kinase activity (pT73-Rab10) and lysosome position",
  "dopamine synapse": "evoked dopamine release and dopamine transporter uptake",
  "immune signalling": "IL-1β and TNF release and surface HLA-DR",
  "protein handling": "proteasome activity and the load of ubiquitinated protein",
  "iron and oxidative stress": "reactive oxygen species (CellROX) and lipid peroxidation and labile iron",
  energy: "oxygen consumption rate and ATP output",
  "growth signalling": "phospho-ERK and phospho-AKT response to GDNF",
  other: "a transcriptome-wide state shift (bulk RNA-seq)",
  none: "a transcriptome-wide state shift (bulk RNA-seq)",
};

export const groupForCell = (k: CellKind) => CELL[k].group;

export function writeHypothesis(symbol: string, f: Record<Facet, Finding>, score: number): Hypothesis {
  const kind = ((f.cell.detail.kind as CellKind) ?? "none") as CellKind;
  const cell = CELL[kind] ?? CELL.none;
  const theme = (f.path.detail.theme as string) ?? "none";
  const molecular = THEME[theme] ?? THEME.other;
  const inhibitors = Object.keys((f.chem.detail.actions as Record<string, number>) ?? {}).some((a) => /INHIBITOR|ANTAGONIST|BLOCKER/.test(a));
  const direction_why = inhibitors
    ? "public data does not say which way helps; existing compounds already reach the inhibition arm"
    : "public data does not say which way helps";
  const short = molecular.split(" and ")[0];
  return {
    score,
    statement: `Knock down and overexpress ${symbol} in ${cell.label}; measure ${molecular} and ${cell.functional}.`,
    direction: "both",
    direction_why,
    cell: cell.label,
    cell_kind: kind,
    theme,
    molecular,
    functional: cell.functional,
    falsifier: `If neither arm moves ${short} by 20% or more against non-targeting and empty-vector controls, across three independent differentiations, the hypothesis is wrong.`,
    lab_ask: `CRISPRi knockdown and lentiviral overexpression of ${symbol} in ${cell.model}; n = 3 differentiations; readouts: ${molecular}; ${cell.functional}. Controls: non-targeting guide, empty vector. About 8 to 10 weeks, most of it differentiation.`,
    scores: Object.fromEntries(FACETS.map((x) => [x, f[x].score])) as Record<Facet, number>,
    dissent: FACETS.filter((x) => f[x].level === "weak" || f[x].level === "absent"),
  };
}
