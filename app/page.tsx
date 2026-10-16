import Link from "next/link";
import { Background, Limits, Sources } from "@/components/background";
import { Bench } from "@/components/bench";
import { Console } from "@/components/console";
import { DatScan } from "@/components/figures";
import { Gate } from "@/components/gate";
import { PlateById } from "@/components/plates";
import { Predict } from "@/components/predict";
import { ReceiptStrip } from "@/components/receipts";
import { ExperimentRows, Funnel, Merged, NotebookEntries, Sec, SwarmCases, Weights } from "@/components/sections";
import { runsFor } from "@/lib/agent/pipeline";
import { RESILIENCE_STAGE } from "@/lib/atlas/cohort";
import { listExperiments } from "@/lib/atlas/experiments";
import { listStudies, STUDIES } from "@/lib/atlas/studies";
import { listCases } from "@/lib/atlas/swarm";
import { chainMode } from "@/lib/chain/oracle";
import { one } from "@/lib/server/db";
import { agentInterval } from "@/lib/server/events";
import { within } from "@/lib/server/timeout";
import { atlasInfo, funnel, notebook } from "@/lib/views";

export const dynamic = "force-dynamic";

const EXAMPLES = ["LRRK2", "GBA1", "SNCA", "PINK1", "TMEM175", "VPS35", "RAB32", "GPNMB"];
const n = (x: number, one: string, many: string) => `${x.toLocaleString("en")} ${x === 1 ? one : many}`;
const every = (s: number) => (s % 60 === 0 ? (s === 60 ? "minute" : `${s / 60} minutes`) : s === 150 ? "two and a half minutes" : `${s} seconds`);

export default async function Home() {
  const mode = await within(chainMode(), 2500, "off" as const);
  const atlas = atlasInfo();
  const f = funnel();
  const nb = notebook();
  const genes = one<{ n: number }>("select count(distinct symbol) as n from runs")?.n ?? 0;
  const lastSymbol = one<{ symbol: string }>("select symbol from runs order by id desc limit 1")?.symbol;
  const last = lastSymbol ? runsFor(lastSymbol, 1)[0] ?? null : null;
  const studies = listStudies();
  const st = atlas.staging;

  return (
    <main>
      <Gate />
      <section className="hero split" aria-labelledby="hero-h">
        <div>
          <p className="kicker">Parkinson&apos;s research notebook</p>
          <h1 id="hero-h">An agent working on Parkinson&apos;s disease, in public.</h1>
          <p className="lede">
            Give it a gene. It reads six public sources and proposes an experiment: which cells to perturb, what should change, and what
            result would rule the idea out. If it can&apos;t make a case, it prints a receipt. Then it tests its predictions on the substantia
            nigra, where Parkinson&apos;s kills its neurons, on donors it hasn&apos;t seen.
          </p>
          <p className="cta"><a className="btn" href="#live">Try a gene</a><a className="link" href="#receipts">Read the receipts</a></p>
        </div>
        <Bench genes={genes} receipts={f.receipts} tested={f.stages[0].n} held={f.stages[1].n} simulated={atlas.simulated} />
      </section>

      <Funnel
        stages={f.stages}
        next={f.next}
        note={<>counted from the ledgers when this page loaded{atlas.simulated ? "; the atlas is simulated, so these test the method, not biology" : ""}</>}
      />

      <Sec id="live" title="Live" className="wide">
        <p>
          This is the agent working, as it happens. It takes a new gene every {every(agentInterval())}, reads it, seals two predictions about the
          nigra, tests them, and comments on what it sees. Type a gene symbol to give it one, or ask it a question.
        </p>
        <Console examples={EXAMPLES} region={atlas.region.replace(" pars compacta", "")} />
      </Sec>

      <Sec id="predict" title="Make a prediction">
        <p>
          Pick a gene, a cell type and an outcome. james hashes your prediction before reading any data, tests it on half of the {atlas.donors}{" "}
          donors, then checks it on the other half, the same way it tests its own. If it fails, the receipt carries your name. Each prediction
          is registered once: if someone got there first, you get their result.
        </p>
        <Predict groups={atlas.groups} chainMode={mode} donors={atlas.donors} />
      </Sec>

      <Background />

      <Sec id="method" title="Method">
        <p>For each gene it collects six scores between 0 and 1. The translation score is their weighted sum; under 0.55 there is no case.</p>
        <Weights />
        <p>
          Genetics has the largest weight because drug targets with human genetic support are about twice as likely to reach approval (Nelson
          et al., <i>Nature Genetics</i>, 2015). Literature is inverted so that heavily studied genes rank low; <i>SNCA</i> scores 0.00 on it.
          The Protein Atlas has no single-cell profile of midbrain dopamine neurons, so a gene enriched in the midbrain (<i>TH</i>,{" "}
          <i>SLC6A3</i>, <i>DDC</i>) counts as a dopamine-neuron gene.
        </p>
        <p>
          Direction is not taken from drug mechanisms. Disease-causing <i>LRRK2</i> variants raise its kinase activity, which made inhibitors
          the obvious arm; the first large trial of one found no slowing of progression. For most genes no such variant exists at all, so until
          the atlas supplies a measured direction, each proposal asks for both knockdown and overexpression.
        </p>
        <p>
          The six findings are combined into a single 1,024-dimensional vector by circular convolution (a holographic reduced representation):
          each finding is bound to a role vector and the results are summed. Any finding can be recovered by unbinding with its role. If one
          cannot, the run is not trusted. Findings scored absent or against are listed as dissent.
        </p>
        <Merged run={last} />
      </Sec>

      <Sec id="atlas" title="Atlas">
        <p>
          The atlas is the substantia nigra pars compacta: for each of {atlas.donors} donors, the average expression of every gene in each of eight
          cell groups, with the donor&apos;s Braak Lewy-body stage, the loss of pigmented neurons in the nigra, and whether they developed
          parkinsonism in life. Single-nucleus studies of this region found that one population of dopamine neurons, marked by <i>SOX6</i> and{" "}
          <i>AGTR1</i>, is the most depleted (Kamath et al., <i>Nature Neuroscience</i>, 2022).
        </p>
        {atlas.simulated && (
          <p className="note" role="note">
            <b>This server is running on a simulated cohort.</b> It is shaped like a nigral atlas ({atlas.donors} donors, Lewy-body staging,
            nigral loss and parkinsonism, the same eight cell groups) so the whole method runs end to end, but the numbers are generated. Results
            from it test the method; they are not findings. Install real pseudobulk data and the same code tests on it.
          </p>
        )}
        <PlateById id="blausen" wide />
        <pre className="ascii" aria-label="The cohort">{[
          `cohort        ${atlas.label}`,
          `cell groups   ${atlas.groups.join(", ")}`,
          `Braak stage   ${st.braak.map((c, i) => `${i}:${c}`).join("  ")}`,
          `parkinsonism  ${st.parkinsonism} of ${atlas.donors} donors`,
          `resilient     ${st.resilient} of the ${st.heavy} donors at stage ${RESILIENCE_STAGE} or beyond never developed parkinsonism`,
          `second region ${atlas.second.region} (${atlas.second.donors} donors${atlas.second.simulated ? ", simulated" : ""})`,
        ].join("\n")}</pre>
        <h3 className="ex-title">Experiments <span>{f.stages[0].n.toLocaleString("en")} tested, {f.stages[1].n} held</span></h3>
        <ExperimentRows rows={listExperiments({ limit: 60 })} />
        <p>
          Protocol: each prediction (gene, cell type, outcome) is hashed before any data is read, tested on a random half of the donors, and must
          replicate on the other half. Predictions that fail either half get a receipt. Predictions that hold are checked again with the cell mix
          controlled, then in a second region, the {atlas.second.region}, the neighbouring dopamine nucleus that Parkinson&apos;s largely spares.
          One outcome of interest is resilience: donors with Lewy pathology at stage {RESILIENCE_STAGE} or beyond who never developed parkinsonism.
        </p>
        <DatScan />
      </Sec>

      <Sec id="notebook" title="Notebook">
        <p>
          Every night at 02:30 UTC it runs the 80 genes with the highest association scores for Parkinson&apos;s in Open Targets
          {nb.pool ? <> ({nb.pool.toLocaleString("en")} genes have some evidence)</> : null} and keeps the top 12.
          {nb.night ? <> These are from the run on {nb.night}.</> : <> Until the first night, these are the best cases so far.</>}
        </p>
        <NotebookEntries entries={nb.entries} />
        <p className="small quiet">{n(nb.investigated, "gene", "genes")} read so far. <Link href="/gene">Every gene on record</Link>.</p>
      </Sec>

      <Sec id="receipts" title="Receipts" className="wide">
        <p>
          A receipt is printed when a translation score is below 0.55, a gene is not found, a source fails mid-run, a finding can&apos;t be
          recovered from the combined vector, an atlas prediction does not replicate, or a sealed study misses its rule. Each receipt contains
          the hash of the one before it. Your browser recomputes the hashes.
        </p>
        <ReceiptStrip limit={8} />
      </Sec>

      <Sec id="swarm" title="Swarm">
        <p>A failed prediction is not the end of the experiment. When an atlas prediction fails, six analysts open a case on its receipt, each from a different angle:</p>
        <ul className="limits">
          <li><b>power:</b> is the effect absent, or real but too small for {Math.floor(atlas.donors / 2)} donors per half?</li>
          <li><b>confounder:</b> does it survive adjustment for age, sex and post-mortem interval?</li>
          <li><b>composition:</b> is it a change within cells, or a shift in the mix of cells as the dopamine neurons die?</li>
          <li><b>cell type:</b> is the gene&apos;s effect stronger in another cell group?</li>
          <li><b>axis:</b> does the gene track another pathology measure better?</li>
          <li><b>skeptic:</b> does the result rest on one donor, or on the most severely affected donors?</li>
        </ul>
        <p>
          The cell-type and axis analysts propose new predictions. The confounder, composition and skeptic analysts challenge every proposal,
          and only proposals that survive all three go forward, sealed and tested on tissue the agent has not read: the {atlas.second.region}, at
          a significance level divided by the number of follow-ups so far. <Link href="/gym">The gym</Link> scores how well these analysts judge.
        </p>
        <p className="chain"><b>{f.swarm.count.toLocaleString("en")}</b> cases, <b>{f.swarm.followups}</b> follow-ups sealed, <b>{f.swarm.same_sign}</b> pointing the same way in the second region, <b>{f.swarm.confirmed}</b> confirmed.</p>
        <SwarmCases cases={listCases(3)} />
      </Sec>

      <Sec id="studies" title="Sealed studies">
        <p>
          Between genes the agent runs studies on whole sets of Parkinson&apos;s genes: the lysosomal genes, the dopamine identity programme,
          mitochondrial quality control. Each is written down with its rule and hashed before its data is read, run once, posted to the live feed,
          and prints a receipt if it misses. <Link href="/program">The lysosome program</Link> is the first.
        </p>
        <ol className="experiments">
          {STUDIES.map((d) => {
            const s = studies.find((x) => x.id === d.id);
            return (
              <li key={d.id} className={s?.result?.passed ? "pass" : ""}>
                <span className="ex-gene"><Link href={`/program#${d.id}`}>{d.title}</Link></span>
                <span className="ex-nums">{d.genes.length} genes, {d.group}</span>
                <span className="ex-verdict">{!s ? "queued" : s.state !== "done" ? "sealed" : s.result?.passed ? "held" : s.receipt ? <Link href={`/receipt/${s.receipt}`}>receipt {String(s.receipt).padStart(4, "0")}</Link> : "missed"}</span>
              </li>
            );
          })}
        </ol>
      </Sec>

      <Sec id="chain" title="On-chain">
        <p>
          Before a prediction is tested, its hash can go on-chain. Predictions you sign with a wallet get their own account in the registry
          program on Solana devnet; the agent writes the split-half result back, and a prediction that replicates mints test tokens to the wallet
          that made it. Holders can put a gene at the front of the agent&apos;s queue.{" "}
          {mode === "off" ? "On-chain writes are off on this server." : mode === "memo" ? "On this server seals and results are written as memo transactions." : "The registry program is live."}
        </p>
        <p><Link className="btn line" href="/chain">Open the registry</Link></p>
      </Sec>

      <Sources />
      <Limits />
    </main>
  );
}
