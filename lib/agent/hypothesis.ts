// The proposal. Readouts come from a fixed table keyed on cell type and pathway theme, so two runs on
// the same evidence write the same experiment. Direction is never guessed: both arms are requested.
import type { Group } from "@/lib/atlas/cohort";
import { FACETS, type CellKind, type Facet, type Finding, type Hypothesis } from "./types";

const CELL: Record<CellKind, { label: string; model: string; functional: string; group: Group }> = {
  neuron: { label: "neurons", model: "iPSC-derived cortical neurons", functional: "phospho-tau (pT217, pT181) accumulation and neurite integrity", group: "excitatory neurons" },
  microglia: { label: "microglia", model: "iPSC-derived microglia (iMGL)", functional: "phagocytosis of amyloid fibrils and synaptosomes (pHrodo)", group: "microglia" },
  astrocyte: { label: "astrocytes", model: "iPSC-derived astrocytes", functional: "glutamate uptake and amyloid clearance", group: "astrocytes" },
  oligodendrocyte: { label: "oligodendrocytes", model: "iPSC-derived oligodendrocytes", functional: "myelin basic protein output and survival under oxidative stress", group: "oligodendrocytes" },
  OPC: { label: "oligodendrocyte precursors", model: "iPSC-derived OPCs", functional: "differentiation into MBP-positive cells", group: "OPCs" },
  none: { label: "a neuron, astrocyte and microglia tri-culture", model: "a tri-culture of iPSC neurons, astrocytes and microglia", functional: "neuronal survival under amyloid-oligomer challenge", group: "excitatory neurons" },
};

const THEME: Record<string, string> = {
  "amyloid and tau": "the secreted Abeta42/40 ratio and sAPPbeta",
  "immune signalling": "IL-1beta and TNF release and the disease-associated marker panel (APOE, SPP1, CST7)",
  "lipid handling": "cholesterol efflux and lipid-droplet load (BODIPY)",
  "endosomal traffic": "early-endosome size (RAB5) and the secreted Abeta42/40 ratio",
  "protein handling": "LC3-II flux and p62 accumulation",
  synapse: "synaptophysin and PSD-95 puncta and spontaneous firing on a multi-electrode array",
  energy: "oxygen consumption rate and ATP output",
  "growth signalling": "phospho-ERK and phospho-AKT response to BDNF",
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
    lab_ask: `CRISPRi knockdown and lentiviral overexpression of ${symbol} in ${cell.model}; n = 3 differentiations; readouts: ${molecular}; ${cell.functional}. Controls: non-targeting guide, empty vector. About 6 to 8 weeks.`,
    scores: Object.fromEntries(FACETS.map((x) => [x, f[x].score])) as Record<Facet, number>,
    dissent: FACETS.filter((x) => f[x].level === "weak" || f[x].level === "absent"),
  };
}
