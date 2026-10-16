import type { Metadata } from "next";
import Link from "next/link";
import { Sec } from "@/components/sections";
import { AXIS_SHORT } from "@/lib/atlas/cohort";
import { ANALYST_READS, ANALYSTS, gym, type Evaluation } from "@/lib/atlas/gym";
import { cohorts } from "@/lib/atlas/cohort";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Research gym",
  description: "The six analysts scored on research questions with known answers: tuned on one set of genes, tested on others, then sealed and scored on predictions made after the seal.",
};

const f3 = (x: number | null) => (x == null ? "n/a" : x.toFixed(3));

function Results({ ev, what }: { ev: Evaluation; what: string }) {
  if (!ev.ready) {
    return (
      <p className="quiet small">
        Not enough answered tasks yet: {ev.n} {what} so far ({ev.train} train, {ev.dev} dev, {ev.positives} that held). The gym scores once there are at
        least 12 train and 5 dev tasks with both outcomes.
      </p>
    );
  }
  const best = Math.min(...ev.rows.map((r) => r.brier ?? 9));
  return (
    <>
      <p className="small">
        {ev.n} tasks: {ev.train} train genes, {ev.dev} dev genes. {ev.positives} held ({((100 * ev.positives) / ev.n).toFixed(0)}%). Base rate on train: {f3(ev.base)}.
        Scores below are on the dev genes only; lower Brier is better, AUC 0.5 is chance.
      </p>
      <div className="scroll-x">
        <table className="tbl">
          <thead><tr><th>model</th><th className="r">Brier</th><th className="r">AUC</th><th className="r">dev tasks</th></tr></thead>
          <tbody>
            {ev.rows.map((r) => (
              <tr key={r.model}><td className={r.brier === best ? "hit" : ""}>{r.model}</td><td className="r">{f3(r.brier)}</td><td className="r">{f3(r.auc)}</td><td className="r">{r.n}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {ev.weights && (
        <pre className="ascii">{["fitted weights (train genes)", `  intercept    ${ev.weights[0].toFixed(2)}`, ...ANALYSTS.map((a, j) => `  ${a.padEnd(12)} ${ev.weights![j + 1] >= 0 ? "+" : ""}${ev.weights![j + 1].toFixed(2)}`)].join("\n")}</pre>
      )}
    </>
  );
}

export default function GymPage() {
  const g = gym();
  const { second } = cohorts();
  const misses = g.followup.ready ? g.followup.misses : g.replication.misses;
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Research gym</p>
        <h1>Can the analysts learn to tell which results will hold?</h1>
        <p className="lede">
          Every prediction james has made was later tested, so its ledgers are full of research questions with known answers. The gym turns them
          into tasks for the six analysts of the swarm, scores their judgement against what actually happened, tunes them on one set of genes,
          and checks them on genes they have never seen. Then the tuned version is sealed by hash and scored on predictions made after the seal.
        </p>
        <p className="stat-line">
          <b>{g.replication.n}</b> replication tasks, <b>{g.followup.n}</b> follow-up tasks; {g.seal ? <>sealed <b>{g.seal.at.slice(0, 16).replace("T", " ")} UTC</b></> : "not sealed yet"}.{" "}
          <a href="/api/gym?format=tasks">Export the tasks</a>
        </p>
      </section>

      <article>
        <Sec title="The tasks">
          <p>
            <b>Replication.</b> A prediction reached p &lt; 0.05 in its discovery half of the donors. Will it hold in the other half? The analysts
            see only the discovery-half donors. The split is rebuilt from the seed written down when the prediction was registered, so the answer
            can&apos;t leak in.
          </p>
          <p>
            <b>Follow-up.</b> The swarm proposed a new prediction after a failure. Will it point the same way, at p &lt; 0.05, in the{" "}
            {second.region}? The analysts see only the first region.
          </p>
          <p>
            Each answer is a probability, scored with the Brier score: the average squared distance between the probability and what happened (0
            is perfect; always answering the base rate is the bar to beat). AUC says how well the probabilities rank the hits above the misses (0.5
            is chance).
          </p>
          <pre className="ascii">{ANALYSTS.map((a) => `${a.padEnd(12)} ${ANALYST_READS[a]}`).join("\n")}</pre>
        </Sec>

        <Sec id="replication" title="Replication">
          <Results ev={g.replication} what="replication tasks" />
        </Sec>

        <Sec id="followup" title="Follow-ups">
          <Results ev={g.followup} what="follow-up tasks" />
          {misses.length > 0 && (
            <>
              <h3 className="ex-title">Where the tuned analysts were most wrong</h3>
              <ol className="experiments">
                {misses.map((t) => (
                  <li key={t.ref}>
                    <span className="ex-gene"><Link href={`/gene/${t.gene}`}><i>{t.gene}</i></Link> in {t.group}, {AXIS_SHORT[t.axis]}</span>
                    <span className="ex-nums">said {(t.p * 100).toFixed(0)}% it would hold</span>
                    <span className="ex-verdict">{t.y ? "it held" : "it did not"}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Sec>

        <Sec id="sealed" title="Sealed, then scored on the future">
          <p>
            A score on held-out genes can still flatter a method that was chosen after looking. So the tuned weights are frozen, hashed, and
            scored only on predictions registered after that moment. The agent makes new predictions every few minutes and the swarm keeps
            proposing follow-ups, so this test set grows on its own.
          </p>
          <pre className="ascii">{g.seal && g.future ? [
            `sealed      ${g.seal.at}`,
            `hash        ${g.seal.hash}`,
            `trained on  ${g.seal.n_train} replication tasks, base rate ${g.seal.base.toFixed(3)}`,
            "",
            `after the seal   replication: ${g.future.replication.n} tasks, Brier ${f3(g.future.replication.brier)} (base rate ${f3(g.future.replication.base_brier)}), AUC ${f3(g.future.replication.auc)}`,
            `                 follow-up:   ${g.future.followup.n} tasks, Brier ${f3(g.future.followup.brier)}, AUC ${f3(g.future.followup.auc)}`,
          ].join("\n") : "not sealed yet: the seal is made once there are 40 training tasks with at least 5 of each outcome"}</pre>
        </Sec>

        <Sec title="Rules">
          <ul className="limits">
            <li>Genes are split into train and dev by a hash of the symbol. No gene is in both.</li>
            <li>Weights are fitted on train only. Dev scores are recomputed as tasks arrive; the sealed version is judged only on the future.</li>
            <li>The tasks are exported in a plain question / answer / metadata format, so any agent or model can be scored on the same set.</li>
            <li>&ldquo;Tuning&rdquo; here means fitting how much weight each analyst&apos;s reading gets. No language model is trained.</li>
            <li>On a simulated cohort the tasks have simulated answers; the gym then measures the method, not biology.</li>
          </ul>
        </Sec>
      </article>
    </main>
  );
}
