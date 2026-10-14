// The six readers. Each one asks one public source about a gene and turns the answer into a 0-1 score.
import { getJSON, SourceError } from "@/lib/server/http";
import { level, type CellKind, type Facet, type Finding, type GeneRef } from "./types";

const OT = "https://api.platform.opentargets.org/api/v4/graphql";
const AD_EFO = "MONDO_0004975"; // Alzheimer disease

const ot = <T>(query: string, variables: Record<string, unknown>) =>
  getJSON<{ data?: T; errors?: { message: string }[] }>("Open Targets", OT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  }).then((r) => {
    if (r.errors?.length) throw new SourceError("Open Targets", r.errors[0].message.slice(0, 120));
    return r.data as T;
  });

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x * 1000) / 1000;
const make = (facet: Facet, score: number, summary: string, detail: Record<string, unknown>): Finding => ({
  facet,
  ok: true,
  score: round(clamp(score)),
  level: level(clamp(score)),
  summary,
  detail,
});

// ---------------------------------------------------------------- gene lookup
type SearchHit = { id: string; object: { approvedSymbol?: string; approvedName?: string } | null };

export async function resolveGene(raw: string): Promise<GeneRef | null> {
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
  if (!symbol) return null;
  const d = await ot<{ search: { hits: SearchHit[] } }>(
    `query($q:String!){ search(queryString:$q, entityNames:["target"], page:{index:0,size:8}){
       hits{ id object{ ... on Target { approvedSymbol approvedName } } } } }`,
    { q: symbol },
  );
  const hit = d.search.hits.find((h) => h.object?.approvedSymbol?.toUpperCase() === symbol);
  if (!hit) return null;
  return { symbol: hit.object!.approvedSymbol!, ensg: hit.id, name: hit.object!.approvedName ?? "" };
}

// ---------------------------------------------------------------- genetics (Open Targets)
export async function readGenetics(g: GeneRef): Promise<Finding> {
  const d = await ot<{
    disease: { associatedTargets: { rows: { score: number; datatypeScores: { id: string; score: number }[] }[] } };
  }>(
    `query($ensg:String!){ disease(efoId:"${AD_EFO}"){ associatedTargets(Bs:[$ensg]){ rows{ score datatypeScores{ id score } } } } }`,
    { ensg: g.ensg },
  );
  const row = d.disease.associatedTargets.rows[0];
  if (!row) return make("genetics", 0, "no association with Alzheimer's on record", { overall: 0 });
  const dt = Object.fromEntries(row.datatypeScores.map((x) => [x.id, round(x.score)]));
  const gen = dt.genetic_association ?? 0;
  return make(
    "genetics",
    gen,
    gen > 0 ? `genetic association ${gen.toFixed(2)} (overall ${row.score.toFixed(2)})` : `no genetic evidence; overall ${row.score.toFixed(2)} from other evidence`,
    { overall: round(row.score), dt },
  );
}

// ---------------------------------------------------------------- chemistry (Open Targets tractability + compounds)
const SM: Record<string, number> = {
  "Approved Drug": 1, "Advanced Clinical": 0.9, "Phase 1 Clinical": 0.8, "Structure with Ligand": 0.6,
  "High-Quality Ligand": 0.6, "High-Quality Pocket": 0.5, "Med-Quality Pocket": 0.4, "Druggable Family": 0.4,
};
const AB: Record<string, number> = {
  "Approved Drug": 1, "Advanced Clinical": 0.9, "Phase 1 Clinical": 0.8, "UniProt loc high conf": 0.5,
  "GO CC high conf": 0.5, "UniProt SigP or TMHMM": 0.4, "UniProt loc med conf": 0.3, "GO CC med conf": 0.3,
  "Human Protein Atlas loc": 0.3,
};
const PR: Record<string, number> = { "Approved Drug": 0.8, "Advanced Clinical": 0.7, "Phase 1 Clinical": 0.6, "Small Molecule Binder": 0.3, Literature: 0.3 };

export async function readChem(g: GeneRef): Promise<Finding> {
  const d = await ot<{
    target: {
      tractability: { label: string; modality: string; value: boolean }[];
      drugAndClinicalCandidates: {
        count: number;
        rows: { maxClinicalStage: string; drug: { name: string; mechanismsOfAction: { rows: { actionType: string }[] } } | null }[];
      };
    } | null;
  }>(
    `query($ensg:String!){ target(ensemblId:$ensg){ tractability{ label modality value }
       drugAndClinicalCandidates{ count rows{ maxClinicalStage drug{ name mechanismsOfAction{ rows{ actionType } } } } } } }`,
    { ensg: g.ensg },
  );
  const t = d.target;
  if (!t) return make("chem", 0, "no tractability record", {});
  const best = (table: Record<string, number>, mod: string) =>
    Math.max(0, ...t.tractability.filter((x) => x.modality === mod && x.value).map((x) => table[x.label] ?? 0));
  const sm = best(SM, "SM"), ab = best(AB, "AB"), pr = best(PR, "PR");
  const drugs = [...new Set(t.drugAndClinicalCandidates.rows.map((r) => r.drug?.name).filter(Boolean) as string[])];
  const actions: Record<string, number> = {};
  for (const r of t.drugAndClinicalCandidates.rows)
    for (const m of r.drug?.mechanismsOfAction.rows ?? []) actions[m.actionType] = (actions[m.actionType] ?? 0) + 1;
  const score = Math.max(sm, ab * 0.9, pr * 0.8);
  const what = sm >= 0.8 || ab >= 0.8 ? "compounds already reach it" : sm >= 0.5 ? "a small-molecule pocket" : ab >= 0.4 ? "reachable by antibody" : "hard to drug";
  return make("chem", score, drugs.length ? `${what}: ${drugs.slice(0, 3).join(", ").toLowerCase()}${drugs.length > 3 ? ` +${drugs.length - 3}` : ""}` : what, {
    sm, ab, pr, drugs: drugs.slice(0, 12), n_drugs: drugs.length, actions,
  });
}

// ---------------------------------------------------------------- cell type (Human Protein Atlas, single-cell RNA)
type HpaRow = {
  Gene: string;
  "RNA single cell type specificity"?: string;
  "RNA single cell type distribution"?: string;
  "RNA single cell type specific nCPM"?: Record<string, string> | null;
  "RNA brain regional specificity"?: string;
  "RNA brain regional distribution"?: string;
};
const brainKind = (cellType: string): CellKind | null =>
  /microglia/i.test(cellType) ? "microglia"
  : /astrocyte/i.test(cellType) ? "astrocyte"
  : /oligodendrocyte precursor|\bOPC/i.test(cellType) ? "OPC"
  : /oligodendrocyte/i.test(cellType) ? "oligodendrocyte"
  : /neuron/i.test(cellType) ? "neuron"
  : null;

export async function readCell(g: GeneRef): Promise<Finding> {
  const rows = await getJSON<HpaRow[]>(
    "Human Protein Atlas",
    `https://www.proteinatlas.org/api/search_download.php?search=${encodeURIComponent(g.symbol)}&format=json&columns=g,rnascs,rnascd,rnascsm,rnabrs,rnabrd&compress=no`,
  );
  const r = rows.find((x) => x.Gene?.toUpperCase() === g.symbol.toUpperCase());
  if (!r) return make("cell", 0, "not in the Protein Atlas", { kind: "none" });
  const spec = r["RNA single cell type specificity"] ?? "";
  const dist = r["RNA single cell type distribution"] ?? "";
  const cells = Object.entries(r["RNA single cell type specific nCPM"] ?? {})
    .map(([c, v]) => [c, Number(v)] as const)
    .sort((a, b) => b[1] - a[1]);
  const brain = cells.filter(([c]) => brainKind(c));
  const brainDist = r["RNA brain regional distribution"] ?? "";
  let score = 0, kind: CellKind = "none", label = spec || "no single-cell data";
  if (brain.length && cells[0] && brainKind(cells[0][0])) {
    score = 1; kind = brainKind(cells[0][0])!; label = `${spec.toLowerCase()} in ${cells[0][0].toLowerCase()} (${Math.round(cells[0][1])} nCPM)`;
  } else if (brain.length) {
    score = 0.75; kind = brainKind(brain[0][0])!; label = `${spec.toLowerCase()}, including ${brain[0][0].toLowerCase()}; strongest in ${cells[0][0].toLowerCase()}`;
  } else if (/detected in (all|many)/i.test(dist) && /detected in (all|many)/i.test(brainDist)) {
    score = 0.4; kind = "none"; label = "expressed broadly, no clear home in brain cells";
  } else if (/not detected/i.test(dist) || !dist) {
    score = 0; label = "not detected in single-cell data";
  } else {
    score = 0.1; label = `${spec.toLowerCase() || "specific"} outside the brain (${cells[0]?.[0]?.toLowerCase() ?? "elsewhere"})`;
  }
  return make("cell", score, label, {
    kind, specificity: spec, distribution: dist, brain_distribution: brainDist,
    cells: Object.fromEntries(cells.slice(0, 6)), elsewhere: cells.filter(([c]) => !brainKind(c)).slice(0, 3).map(([c]) => c),
  });
}

// ---------------------------------------------------------------- trials (ClinicalTrials.gov)
const STOPPED = new Set(["TERMINATED", "WITHDRAWN", "SUSPENDED"]);

export async function readClinic(g: GeneRef, drugs: string[]): Promise<Finding> {
  const terms = [g.symbol, ...drugs.slice(0, 3)].map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
  const d = await getJSON<{ totalCount?: number; studies: { protocolSection: { identificationModule: { nctId: string; briefTitle: string }; statusModule: { overallStatus: string } } }[] }>(
    "ClinicalTrials.gov",
    `https://clinicaltrials.gov/api/v2/studies?query.cond=Alzheimer&query.term=${encodeURIComponent(terms)}&countTotal=true&pageSize=50&fields=NCTId,OverallStatus,BriefTitle`,
  );
  const status: Record<string, number> = {};
  for (const s of d.studies) {
    const k = s.protocolSection.statusModule.overallStatus;
    status[k] = (status[k] ?? 0) + 1;
  }
  const total = d.totalCount ?? d.studies.length;
  const stopped = Object.entries(status).filter(([k]) => STOPPED.has(k)).reduce((a, [, n]) => a + n, 0);
  const seen = Math.max(1, d.studies.length);
  const score = total === 0 ? 1 : Math.max(0.2, 1 - 0.8 * (stopped / seen));
  const examples = d.studies.slice(0, 3).map((s) => ({ id: s.protocolSection.identificationModule.nctId, title: s.protocolSection.identificationModule.briefTitle, status: s.protocolSection.statusModule.overallStatus }));
  return make(
    "clinic",
    score,
    total === 0 ? "no Alzheimer's trials on record: an open field" : `${total} Alzheimer's trial${total === 1 ? "" : "s"}, ${stopped} stopped`,
    { total, stopped, status, examples, query: terms, ambiguous: g.symbol.length <= 3, against: stopped / seen > 0.5 },
  );
}

// ---------------------------------------------------------------- literature (PubMed; well-trodden ground scores low)
let ncbiQueue: Promise<unknown> = Promise.resolve();
function ncbiCount(term: string): Promise<number> {
  const key = process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "";
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&rettype=count&term=${encodeURIComponent(term)}${key}`;
  // NCBI allows three requests a second without a key: queue the calls with a gap between them
  const job = ncbiQueue.then(() => getJSON<{ esearchresult: { count: string } }>("PubMed", url));
  ncbiQueue = job.catch(() => null).then(() => new Promise((r) => setTimeout(r, key ? 120 : 380)));
  return job.then((d) => Number(d.esearchresult.count));
}

export async function readLit(g: GeneRef): Promise<Finding> {
  const both = await ncbiCount(`${g.symbol}[tiab] AND (alzheimer*[tiab] OR "amyloid beta"[tiab])`);
  const alone = await ncbiCount(`${g.symbol}[tiab]`);
  const score = 1 - Math.log10(both + 1) / Math.log10(2000);
  const rare = g.symbol.length <= 3 && alone > 20000;
  return make(
    "lit",
    score,
    both === 0 ? "no papers tie it to Alzheimer's yet" : `${both.toLocaleString("en")} Alzheimer's papers of ${alone.toLocaleString("en")}${both > 500 ? ": well-trodden" : ""}`,
    { both, alone, rare_name: rare },
  );
}

// ---------------------------------------------------------------- pathways (Reactome)
const THEMES: [string, RegExp, number][] = [
  ["amyloid and tau", /amyloid|\bAPP\b|\btau\b|gamma-secretase|NOTCH/i, 1],
  ["immune signalling", /immun|interleukin|toll|TLR|cytokine|complement|interferon|NF-kB|DAP12|TREM|\bFc|neutrophil|MHC|antigen|inflamm/i, 1],
  ["lipid handling", /lipid|cholesterol|lipoprotein|fatty acid|sphingo|phospholipid|LDL|HDL/i, 1],
  ["endosomal traffic", /endocyt|endosom|vesicle|clathrin|golgi|trafficking|lysosom|transport to/i, 1],
  ["protein handling", /proteasom|ubiquitin|autophag|unfolded|chaperone|degradation|SUMO|folding/i, 0.9],
  ["synapse", /neurotransmitter|synap|neuronal system|potassium channel|glutamate|GABA|NMDA|AMPA/i, 0.8],
  ["energy", /metabolism|mitochond|respiratory|TCA|glycolysis|oxidative/i, 0.6],
  ["growth signalling", /signaling by|MAPK|RAF|\bRTK|PI3K|AKT|kinase|GPCR|NTRK|BDNF/i, 0.6],
];

export async function readPath(g: GeneRef): Promise<Finding> {
  let rows: { displayName: string; stId: string }[] = [];
  try {
    rows = await getJSON("Reactome", `https://reactome.org/ContentService/data/mapping/ENSEMBL/${g.ensg}/pathways?species=9606`);
  } catch (e) {
    if (!(e instanceof SourceError && /404/.test(e.message))) throw e;
  }
  const themes: Record<string, number> = {};
  for (const p of rows)
    for (const [name, re] of THEMES) if (re.test(p.displayName)) themes[name] = (themes[name] ?? 0) + 1;
  const ranked = Object.keys(themes).sort((a, b) => {
    const w = (t: string) => THEMES.find((x) => x[0] === t)![2];
    return w(b) - w(a) || themes[b] - themes[a];
  });
  const theme = ranked[0] ?? (rows.length ? "other" : "none");
  const score = !rows.length ? 0 : ranked.length ? THEMES.find((x) => x[0] === theme)![2] : 0.3;
  return make(
    "path",
    score,
    !rows.length ? "in no curated pathway" : `${rows.length} pathway${rows.length === 1 ? "" : "s"}; mostly ${theme}`,
    { theme, themes, n: rows.length, examples: rows.slice(0, 4).map((p) => p.displayName) },
  );
}

export const READERS = { genetics: readGenetics, cell: readCell, lit: readLit, path: readPath } as const;
