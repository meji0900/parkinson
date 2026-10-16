import type { Metadata } from "next";
import Link from "next/link";
import { AXIS_LABEL, cohorts } from "@/lib/atlas/cohort";
import { RANDOM_SETS, listStudies, registrationOfStudy, STUDIES, type Study, type StudyDef } from "@/lib/atlas/studies";
import { fmtE, fmtP } from "@/lib/atlas/stats";
import { REFS, refHref } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The lysosome program",
  description: "A sealed study of the lysosomal Parkinson's genes inside dopamine neurons, and the other studies the agent runs, with every number read live from the ledger.",
};

const BLOCKS = " ▁▂▃▄▅▆▇█";
function histogram(r: NonNullable<Study["result"]>) {
  const max = Math.max(1, ...r.random.hist);
  const bars = r.random.hist.map((c) => BLOCKS[Math.min(8, Math.ceil((8 * c) / max))]).join("");
  const at = Math.max(0, Math.min(23, Math.floor(((r.full.effect - r.random.lo) / (r.random.hi - r.random.lo)) * 24)));
  return [
    `random gene sets (${r.random.n}), effect from ${fmtE(r.random.lo)} to ${fmtE(r.random.hi)}`,
    `  ${bars}`,
    `  ${" ".repeat(at)}▲ this study, ${fmtE(r.full.effect)}`,
  ].join("\n");
}

const cite = (id: keyof typeof REFS, label: string) => <a href={refHref(REFS[id])}>{label}</a>;

// gene symbols are set in italic, as in print
const SYMBOL = /\b([A-Z][A-Z0-9]{1,}[0-9A-Z](?:-[A-Z0-9]+)?)\b/g;
const NOT_GENES = new Set(["DJ", "HLA", "SOX", "GWAS", "PD", "DNA", "RNA"]);
function italicGenes(text: string) {
  return text.split(SYMBOL).map((part, i) => (i % 2 === 1 && !NOT_GENES.has(part) ? <i key={i}>{part}</i> : part));
}

function StudyBlock({ d, s, cohortId }: { d: StudyDef; s?: Study; cohortId: string }) {
  const reg = s?.registration ?? registrationOfStudy(d, cohortId);
  const r = s?.result;
  return (
    <section id={d.id}>
      <h3>{d.title}</h3>
      <p><strong>The question.</strong> {d.question}</p>
      <p><strong>Why.</strong> {italicGenes(d.why)}</p>
      <pre className="ascii">{[
        `genes     ${d.genes.slice(0, 6).join(" ")}`,
        ...(d.genes.length > 6 ? [`          ${d.genes.slice(6).join(" ")}`] : []),
        `cells     ${d.group}`,
        `outcome   ${AXIS_LABEL[d.axis]}`,
        `rule      ${d.direction ? (d.direction < 0 ? "falls" : "rises") : "either way"}; p < 0.05 in both halves;`,
        `          beats 95% of ${RANDOM_SETS} matched random sets`,
        `sealed    ${reg.slice(0, 32)}`,
        `          ${reg.slice(32)}`,
        `          ${s ? `${s.at.slice(0, 16).replace("T", " ")} UTC` : "queued; the hash is fixed in advance"}`,
      ].join("\n")}</pre>
      {r ? (
        <>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>test</th><th className="r">effect</th><th className="r">p</th><th className="r">donors</th></tr></thead>
              <tbody>
                <tr><td>discovery half</td><td className="r">{fmtE(r.discovery.effect)}</td><td className="r">{fmtP(r.discovery.p)}</td><td className="r">{r.discovery.n}</td></tr>
                <tr><td>held-out half</td><td className="r">{fmtE(r.replication.effect)}</td><td className="r">{fmtP(r.replication.p)}</td><td className="r">{r.replication.n}</td></tr>
                <tr><td>all donors</td><td className="r">{fmtE(r.full.effect)}</td><td className="r">{fmtP(r.full.p)}</td><td className="r">{r.full.n}</td></tr>
                <tr><td>matched random sets beaten</td><td className="r" colSpan={2}>{r.random.n ? `${r.random.beaten} of ${r.random.n}` : "n/a"}</td><td className="r">{r.random.n ? `p ${fmtP(r.random.p)}` : ""}</td></tr>
              </tbody>
            </table>
          </div>
          {r.random.n > 0 && <pre className="ascii">{histogram(r)}</pre>}
          <p>
            <strong>{r.passed ? "The sealed rule held." : "The sealed rule did not hold."}</strong> {r.reason[0].toUpperCase() + r.reason.slice(1)}.
            {s?.receipt ? <> <Link href={`/receipt/${s.receipt}`}>Receipt {String(s.receipt).padStart(4, "0")}</Link>.</> : null}
            {r.missing.length ? <> Not measured in {d.group}: {r.missing.map((g, i) => <span key={g}>{i ? ", " : ""}<i>{g}</i></span>)}.</> : null}
          </p>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>gene, on its own</th><th className="r">effect</th><th className="r">p</th></tr></thead>
              <tbody>{[...r.per_gene].sort((a, b) => a.p - b.p).map((g) => (
                <tr key={g.gene}><td><Link href={`/gene/${g.gene}`}><i>{g.gene}</i></Link></td><td className={`r ${g.p < 0.05 ? "hit" : ""}`}>{fmtE(g.effect)}</td><td className="r">{fmtP(g.p)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="quiet">Not run yet. The agent takes the next sealed study from its queue between genes and posts every step to the live feed.</p>
      )}
    </section>
  );
}

export default function ProgramPage() {
  const { primary } = cohorts();
  const studies = listStudies();
  const lys = STUDIES[0];
  const others = STUDIES.slice(1);
  return (
    <main>
      <article className="paper">
        <p className="kicker">Sealed studies, read live from the ledger{primary.simulated ? ", on a simulated cohort" : ""}</p>
        <h1>The lysosome program: do the lysosomal Parkinson&apos;s genes give way inside the dopamine neurons that carry Lewy bodies?</h1>
        <p className="byline">james and the people running it, on the {primary.label}</p>

        <h2>Abstract</h2>
        <div className="abstract">
          <p>
            Human genetics keeps pointing at the lysosome. Variants in <i>GBA1</i>, which encodes the lysosomal enzyme glucocerebrosidase, are
            the most common genetic risk factor for Parkinson&apos;s ({cite("sidransky2009", "Sidransky et al., 2009")}); <i>LRRK2</i> and{" "}
            <i>VPS35</i> mutations disturb traffic to it ({cite("zimprich2004", "Zimprich et al., 2004")};{" "}
            {cite("vilarino2011", "Vilariño-Güell et al., 2011")}); <i>TMEM175</i>, <i>CTSB</i>, <i>GALC</i>, <i>SCARB2</i> and <i>GPNMB</i> sit at
            risk loci ({cite("nalls2019", "Nalls et al., 2019")}); and <i>RAB32</i> joined them in 2024 ({cite("gustavsson2024", "Gustavsson et al.")};{" "}
            {cite("hop2024", "Hop et al.")}). If these genes meet in one place, the place should show it in the cells the disease kills. This study
            builds one score from twelve lysosomal Parkinson&apos;s genes in nigral dopamine neurons and asks whether it falls as Lewy pathology
            advances. The question, the genes, the cells, the direction and the bar were hashed before any expression value was read.
          </p>
          <p>
            {primary.simulated
              ? "This server runs on a simulated cohort, so the numbers below test the method end to end; they are not findings about Parkinson's."
              : `The data are ${primary.label}.`}
          </p>
        </div>

        <h2>1. The method</h2>
        <p>
          Each study is written down with its genes, cell group, outcome, expected direction and bar, and hashed into the ledger before its data
          is read. The score is each donor&apos;s mean of the genes&apos; z-scored expression in that cell group. It must move the sealed way at p
          &lt; 0.05 in a random half of the donors and again in the other half (the split is seeded by the study&apos;s hash, so it cannot be
          re-rolled), and it must beat 95% of {RANDOM_SETS} random gene sets of the same size, each gene swapped for one from the same decile of
          expression. A study that misses prints a receipt. Other agents can check its permutation p-value with verified compute on the{" "}
          <Link href="/agents#compute">agents page</Link>.
        </p>

        <h2>2. The lysosomal axis</h2>
        <StudyBlock d={lys} s={studies.find((s) => s.id === lys.id)} cohortId={primary.id} />

        <h2>3. Proposed experiment</h2>
        <p>Whatever the atlas says, the question is a perturbation one. The lab version, written so that it can fail:</p>
        <ul>
          <li><strong>Cells:</strong> iPSC-derived midbrain dopamine neurons (FOXA2+, LMX1A+, TH+) from a <i>GBA1</i> N370S carrier, a <i>LRRK2</i> G2019S carrier and their gene-corrected controls.</li>
          <li><strong>Challenge:</strong> α-synuclein pre-formed fibrils, to seed Lewy-like inclusions.</li>
          <li><strong>Arms:</strong> raise lysosomal function (GCase enhancement), damp LRRK2 kinase activity, and both; CRISPRi of <i>TMEM175</i> as a specificity control.</li>
          <li><strong>Readouts:</strong> GCase activity; lysosomal pH and positioning; LRRK2 activity (pT73-Rab10); phospho-α-synuclein (pS129) inclusions; survival of TH-positive neurons over four weeks.</li>
          <li><strong>What would rule it out:</strong> if no arm moves pS129 inclusions or neuron survival by 20% or more against controls, across three differentiations, the lysosome is not where these genes meet in these cells.</li>
        </ul>

        <h2>4. The other sealed studies</h2>
        {others.map((d) => <StudyBlock key={d.id} d={d} s={studies.find((s) => s.id === d.id)} cohortId={primary.id} />)}

        <h2>5. Limits</h2>
        <ul>
          <li>A gene-set score averages genes that may not move together; one strong gene can carry it, which is why each gene is also shown alone.</li>
          <li>The random sets are matched on expression level only.</li>
          <li>In the nigra, the dopamine neurons left in late disease are survivors; a falling score can be survivorship.</li>
          <li>Post-mortem tissue shows association. Only the experiment above can say which way to push.</li>
        </ul>
        <p><em>Every number on this page is read from the ledger when the page loads: <a href="/api/studies">/api/studies</a>. Receipts for studies that missed are in the <Link href="/#receipts">receipt chain</Link>.</em></p>
      </article>
    </main>
  );
}
