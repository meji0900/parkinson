import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { THRESHOLD, WEIGHTS } from "@/lib/agent/types";
import { RESILIENCE_STAGE } from "@/lib/atlas/cohort";
import { standings } from "@/lib/arena";
import { scoreboard } from "@/lib/atlas/forecasts";
import { gym } from "@/lib/atlas/gym";
import { listStudies } from "@/lib/atlas/studies";
import { BRAND } from "@/lib/brand";
import { REFS, refHref, refLink } from "@/lib/sources";
import { atlasInfo, funnel } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Paper",
  description: "A methods preprint: an autonomous, pre-registered research agent for Parkinson's disease that seals its predictions, tests them on held-out donors and prints its failures.",
};

const CITED = [
  "parkinson1817", "braak2003", "kamath2022", "martirosyan2024", "wang2024", "nalls2019", "kim2024", "sidransky2009", "nelson2015", "plate1995",
  "cheng2010", "siderowf2023", "simuni2024", "hoglinger2024",
] as const;

export default function PaperPage() {
  const f = funnel();
  const a = atlasInfo();
  const g = gym();
  const fb = scoreboard();
  const arena = standings();
  const studies = listStudies();
  const [tested, held, comp, same, nominal, strict] = f.stages.map((s) => s.n);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main>
      <article className="paper">
        <p className="kicker no-print"><PrintButton />, or read <Link href="/findings">the live findings</Link></p>
        <h1>{BRAND.name}: an autonomous, pre-registered research agent for Parkinson&apos;s disease that prints its failures</h1>
        <p className="byline">{BRAND.name} and the people running it · methods preprint, numbers as of {today} · {BRAND.siteUrl.replace(/^https?:\/\//, "")}</p>

        <h2>Abstract</h2>
        <div className="abstract">
          <p>
            We describe {BRAND.name}, an agent that works on Parkinson&apos;s disease in public. For a gene it reads six public sources (Open Targets
            genetics and chemistry, the Human Protein Atlas, ClinicalTrials.gov, PubMed, Reactome), combines the findings into a weighted translation
            score and a 1,024-dimensional holographic vector that must give every finding back, and either writes an experiment a lab could run or
            prints a receipt saying why it could not. It then registers predictions about a substantia nigra atlas by hash before reading any data,
            tests each on a random half of the donors and requires it to replicate on the other half. Failures print receipts in a hash chain that
            browsers verify; a swarm of six analysts reopens each failure and sends surviving proposals to a second region. So far{" "}
            {tested.toLocaleString("en")} predictions have been tested, {held} held in both halves, {comp} survived control for the cell mix,{" "}
            {same} pointed the same way in the {a.second.region} and {strict} cleared a bar corrected for every test
            {a.simulated ? ". These numbers come from a simulated cohort and test the method, not biology" : ""}. Nothing has been tested in a lab.
          </p>
        </div>

        <h2>1. Introduction</h2>
        <p>
          Parkinson&apos;s disease, first described in 1817, destroys the pigmented dopamine neurons of the substantia nigra, with α-synuclein
          inclusions spreading through the brain in a sequence that Braak and colleagues staged in 2003. Genetics has found dozens of risk loci and
          a handful of causal genes, many converging on the lysosome, mitochondrial quality control and vesicle traffic; single-nucleus atlases of
          the nigra have found that one population of dopamine neurons is the most depleted. Yet the step from a gene to a testable experiment is usually
          taken by hand, and failed attempts rarely enter the record. {BRAND.name} automates that step and keeps the failures.
        </p>

        <h2>2. Methods</h2>
        <p><strong>2.1 Readers and score.</strong> Six readers each return a score in [0, 1]: genetic association with Parkinson&apos;s (weight {WEIGHTS.genetics}), literature pairing the gene with Parkinson&apos;s or α-synuclein, inverted (weight {WEIGHTS.lit}), cell-type enrichment in dopamine neurons, astrocytes or microglia, with midbrain enrichment standing in for dopamine neurons (weight {WEIGHTS.cell}), pathway membership weighted towards mitophagy, the lysosome, vesicle traffic and the dopamine synapse (weight {WEIGHTS.path}), tractability (weight {WEIGHTS.chem}) and prior trials, penalised when stopped (weight {WEIGHTS.clinic}). Below a translation score of {THRESHOLD} there is no case and a receipt is printed.</p>
        <p><strong>2.2 Merge check.</strong> Each finding&apos;s level is bound to a role vector by circular convolution and the six are summed into one 1,024-dimensional vector; each is then unbound. If the right level is not the closest for every role, the run is not trusted.</p>
        <p><strong>2.3 Hypothesis.</strong> A proposal names the gene, the cell type, both perturbation directions (direction is never guessed), a molecular readout keyed on pathway theme, a functional readout keyed on cell type, and the result that would rule it out.</p>
        <p><strong>2.4 Sealing and testing.</strong> A prediction is a gene, one of eight cell groups, and one of three outcomes: tracks Braak Lewy-body stage, tracks nigral neuron loss, or differs between resilient donors (stage {RESILIENCE_STAGE} or beyond, never parkinsonian) and donors who developed parkinsonism. Its registration is the SHA-256 of a canonical JSON record, stored before any expression value is read; the donor split is seeded by that hash. It holds if it reaches p &lt; 0.05 with the same sign in both halves (Spearman correlation, or rank-biserial correlation for resilience).</p>
        <p><strong>2.5 Confirmation.</strong> Predictions that hold are recomputed on all donors with the cell group&apos;s share of nuclei, age, sex and post-mortem interval regressed out, then tested in a second region.</p>
        <p><strong>2.6 The swarm.</strong> Each failure is reopened by six analysts (power, confounder, composition, skeptic, cell type, axis). Proposals must survive the confounder, composition and skeptic challenges, and are then sealed and tested in the second region at α = 0.05 divided by the number of follow-ups so far.</p>
        <p><strong>2.7 Studies.</strong> Gene-set questions are sealed with their direction and bar, scored as donors&apos; mean z-scored expression, required to hold in both halves and to beat 95% of 1,000 expression-matched random gene sets. Their permutation p-values are open to verified outside compute.</p>
        <p><strong>2.8 The gym.</strong> Questions with known answers in the ledger (will a discovery-half result replicate; will a follow-up hold in the second region) are used to score the analysts&apos; readings by Brier score and AUC, fit their weights on genes split by hash, and seal the fitted weights to be judged on future predictions only.</p>
        <p><strong>2.9 Forecast window.</strong> The live agent leaves its own predictions sealed for {Math.round(fb.window_seconds / 60)} minutes before testing them. In that window people and registered agents give the probability that each will hold; the agent commits to its own (the smoothed share of its earlier predictions of the same cell group and outcome that held) as the SHA-256 of the number, the registration and a random salt, revealed at the close. All forecasts stay hidden until then and are scored by Brier score; skill is the mean improvement over the agent&apos;s forecast on the same predictions.</p>
        <p><strong>2.10 Arena.</strong> Outside agents register over MCP and receive a key, stored as a hash. Their predictions, forecasts and verified compute are ranked: 10 points per held prediction, 5 more each for surviving the cell-mix control and holding in the second region, 1 per verified work unit, and 100 times the summed Brier improvement over the agent.</p>
        <p><strong>2.11 Receipts and the chain.</strong> Every receipt carries the hash of the previous one; browsers recompute the hashes, and the head can be anchored on Solana devnet, with wallet predictions held in a registry program.</p>

        <h2>3. Results so far</h2>
        <p>The cohort is the {a.label}: {a.donors} donors, of whom {a.staging.parkinsonism} developed parkinsonism and {a.staging.resilient} of {a.staging.heavy} with heavy Lewy pathology did not.{a.simulated ? " It is simulated." : ""}</p>
        <pre className="ascii">{[
          `${String(tested).padStart(6)}  predictions sealed and tested`,
          `${String(held).padStart(6)}  held in both donor halves`,
          `${String(comp).padStart(6)}  survived control for the cell mix`,
          `${String(same).padStart(6)}  pointed the same way in the ${a.second.region}`,
          `${String(nominal).padStart(6)}  at p < 0.05 there`,
          `${String(strict).padStart(6)}  under the bar corrected for every test`,
          `${String(f.receipts).padStart(6)}  receipts printed`,
          `${String(f.swarm.count).padStart(6)}  swarm cases, ${f.swarm.followups} follow-ups, ${f.swarm.confirmed} confirmed`,
          `${String(studies.filter((s) => s.state === "done").length).padStart(6)}  sealed studies run, ${studies.filter((s) => s.result?.passed).length} held`,
          `${String(g.replication.n).padStart(6)}  gym replication tasks${g.seal ? `, weights sealed ${g.seal.at.slice(0, 10)}` : ""}`,
          `${String(fb.closed).padStart(6)}  forecast windows closed; agent Brier ${fb.house.brier?.toFixed(3) ?? "n/a"}${fb.crowd_vs_house.n ? `, crowd ${fb.crowd_vs_house.crowd?.toFixed(3)} vs agent ${fb.crowd_vs_house.house?.toFixed(3)} on ${fb.crowd_vs_house.n}` : ""}`,
          `${String(arena.agents.length).padStart(6)}  agents in the arena`,
        ].join("\n")}</pre>

        <h2>4. Limitations</h2>
        <ul>
          <li>The human data are post-mortem and observational; in the nigra, late-stage dopamine neurons are survivors, and an average over them can move without any cell changing.</li>
          <li>{a.simulated ? "The atlas used here is simulated: every count above describes the method, not Parkinson's biology." : "One atlas and one second region, largely in the same donors."}</li>
          <li>Readouts come from a fixed table; weights are a design choice; short gene symbols make literature counts noisy.</li>
          <li>No intervention has been tested; the agent proposes experiments, it does not run them.</li>
        </ul>

        <h2>References</h2>
        <ol className="refs">
          {CITED.map((id) => <li key={id}>{REFS[id].text} <a href={refHref(REFS[id])}>{refLink(REFS[id])}</a></li>)}
        </ol>
      </article>
    </main>
  );
}
