import Link from "next/link";
import { Console } from "@/components/console";
import { Predict } from "@/components/predict";
import { ReceiptStrip } from "@/components/receipts";
import { Background } from "@/components/background";
import { Entry, ExperimentRows, Method, NotebookEntries, SwarmCases } from "@/components/sections";
import { listExperiments } from "@/lib/atlas/experiments";
import { listCases } from "@/lib/atlas/swarm";
import { chainMode } from "@/lib/chain/oracle";
import { one } from "@/lib/server/db";
import { within } from "@/lib/server/timeout";
import { atlasInfo, funnel, notebook } from "@/lib/views";

export const dynamic = "force-dynamic";

const EXAMPLES = ["TREM2", "PLCG2", "SORL1", "ABCA7", "BIN1", "APOE", "SPRY4"];
const n = (x: number, one: string, many: string) => `${x.toLocaleString("en")} ${x === 1 ? one : many}`;

export default async function Home() {
  const mode = await within(chainMode(), 2500, "off" as const);
  const atlas = atlasInfo();
  const f = funnel();
  const nb = notebook();
  const genes = one<{ n: number }>("select count(distinct symbol) as n from runs")?.n ?? 0;
  const tested = f.stages[0].n, held = f.stages[1].n;

  return (
    <main className="page">
      <section className="hero" aria-labelledby="hero-h">
        <h1 id="hero-h">An Alzheimer&apos;s research agent that works where you can watch.</h1>
        <p className="lede">
          Give it a gene. It reads six public sources, scores the case, and either writes an experiment a lab could run or prints a
          receipt saying why it couldn&apos;t. Its predictions are sealed before it reads any data, and every failure stays on the record.
        </p>
        <p className="tally">
          <span><b>{n(genes, "gene", "genes")}</b> read</span>
          <span><b>{n(f.receipts, "receipt", "receipts")}</b></span>
          <span><b>{n(tested, "sealed prediction", "sealed predictions")}</b> tested, <b>{held.toLocaleString("en")}</b> held</span>
          {atlas.simulated && <span className="badge">atlas: simulated cohort</span>}
        </p>
        <Console examples={EXAMPLES} />
      </section>

      <Entry id="predict" note="Make a prediction" sub="Your guess goes through the same test as the agent's own.">
        <h2>Pick a gene, a cell type and an outcome.</h2>
        <p>
          The prediction is hashed and stored before a single expression value is read. Then it is tested on a random half of
          the {atlas.donors} donors and has to hold again, pointing the same way, on the other half. Each prediction can be
          registered once; asking again returns the recorded result.
        </p>
        <Predict groups={atlas.groups} chainMode={mode} />
      </Entry>

      <Entry id="notebook" note="The notebook" sub={nb.night ? `Kept from the run on ${nb.night}, 02:30 UTC.` : "Filled by the nightly run at 02:30 UTC."}>
        <h2>The strongest cases so far.</h2>
        <p>
          Every night the agent reads the 80 best-scored Alzheimer&apos;s targets on Open Targets and keeps the twelve with the
          strongest case. Bars show what each of the six readers found.
        </p>
        <NotebookEntries entries={nb.entries} />
      </Entry>

      <Entry id="method" note="How it works" sub="The same six steps, for every gene.">
        <h2>From a gene symbol to an experiment, or a receipt.</h2>
        <Method />
      </Entry>

      <Entry id="atlas" note="The atlas" sub={`${atlas.donors} donors, ${atlas.groups.length} cell groups, ${atlas.region}.`}>
        <h2>Where predictions meet tissue.</h2>
        {atlas.simulated && (
          <div className="sim" role="note">
            <span>
              <b>This server is running on a simulated cohort.</b> It is shaped like SEA-AD (84 donors, Braak and Thal staging,
              dementia status, the same cell groups) so the whole method can run end to end, but the numbers are generated. Results
              from it exercise the method; they are not findings. Install real pseudobulk data and the same code tests on it.
            </span>
          </div>
        )}
        <p>
          The temporal cortex is where Alzheimer&apos;s pathology spreads early. Each prediction asks whether a gene&apos;s
          expression in one cell group moves with tau stage (Braak), amyloid phase (Thal), or differs between demented donors and
          resilient ones, who carry heavy pathology without dementia. Predictions that hold are re-checked with the cell mix
          controlled, then in a second region: the {atlas.second.region}.
        </p>
        <h3>Latest results</h3>
        <ExperimentRows rows={listExperiments({ limit: 60 })} />
        <p className="small" style={{ marginTop: 14 }}>
          <Link href="/findings">The full funnel, from every sealed prediction to the few that survive every check</Link>
        </p>
      </Entry>

      <Entry id="receipts" note="Receipts" sub="Each one carries the hash of the one before it." wide={<ReceiptStrip />}>
        <h2>Every failure, printed.</h2>
        <p>
          A receipt prints when the translation score is under 0.55, a gene can&apos;t be found, a source fails, the merge loses a
          finding, or an atlas prediction does not replicate. The head of the chain is written to Solana devnet, so the list
          can&apos;t be trimmed after the fact.
        </p>
      </Entry>

      <Entry id="swarm" note="The swarm" sub="Six analysts per failed prediction.">
        <h2>What a failure might have been missing.</h2>
        <p>
          After a failed atlas prediction, six analysts open a case: power, confounder, composition, skeptic, cell type and axis.
          A new prediction they propose must survive the confounder, composition and skeptic challenges before it is sealed and
          tested in the second region, at a threshold corrected for every follow-up made so far.
        </p>
        <SwarmCases cases={listCases(3)} />
      </Entry>

      <Entry id="chain" note="On-chain" sub="Solana devnet, for now.">
        <h2>Seals, results and rewards you can check without trusting this server.</h2>
        <p>
          Before a prediction is tested, its hash goes on-chain. Predictions you sign with a wallet get their own account in the
          registry program; the agent writes the split-half result back, and a prediction that replicates mints test tokens to
          the wallet that made it. Holders can put a gene at the front of the agent&apos;s queue.
        </p>
        <p><Link className="btn" href="/chain">Open the registry</Link></p>
      </Entry>

      <Background />
    </main>
  );
}
