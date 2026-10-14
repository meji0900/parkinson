// Home page sections, rendered on the server from the ledgers.
import Link from "next/link";
import { Fragment } from "react";
import type { Hypothesis } from "@/lib/agent/types";
import { FACET_LABEL, FACETS, SOURCE, THRESHOLD, WEIGHTS } from "@/lib/agent/types";
import type { Experiment } from "@/lib/atlas/experiments";
import type { SwarmCase } from "@/lib/atlas/swarm";
import { Replay } from "./replay";

export function Entry({ id, note, sub, children, wide }: { id?: string; note: string; sub?: React.ReactNode; children: React.ReactNode; wide?: React.ReactNode }) {
  return (
    <section className="entry" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="note"><b id={id ? `${id}-h` : undefined}>{note}</b>{sub}</div>
      <div className="body">{children}</div>
      {wide && <div className="wide">{wide}</div>}
    </section>
  );
}

const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

export function NotebookEntries({ entries }: { entries: { symbol: string; name: string; at: string; hypothesis: Hypothesis }[] }) {
  if (!entries.length) return <p className="quiet">No proposals yet. The agent writes one whenever a gene clears a translation score of {THRESHOLD}.</p>;
  return (
    <ul className="entries">
      {entries.map((e) => (
        <li key={e.symbol}>
          <div className="head">
            <h3><Link href={`/gene/${e.symbol}`} style={{ textDecoration: "none" }}><i className="g">{e.symbol}</i></Link> in {e.hypothesis.cell}</h3>
            <span className={`score${e.hypothesis.score < 0.6 ? " low" : ""}`}>{e.hypothesis.score.toFixed(2)}</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 17 }}>{e.hypothesis.statement}</p>
          <div className="bars" aria-label="Reader scores">
            {FACETS.map((f) => (
              <Bar key={f} label={FACET_LABEL[f]} v={e.hypothesis.scores[f] ?? 0} />
            ))}
          </div>
          <p className="small quiet" style={{ margin: "12px 0 0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>{e.hypothesis.dissent.length ? `Dissent from ${e.hypothesis.dissent.map((f) => FACET_LABEL[f]).join(", ")}.` : "No reader dissented."}</span>
            <Replay gene={e.symbol} />
          </p>
        </li>
      ))}
    </ul>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <>
      <span>{label}</span>
      <span className="bar"><i style={{ width: pct(v) }} /></span>
      <span className="v">{v.toFixed(2)}</span>
    </>
  );
}

export function Method() {
  return (
    <>
      <ol className="steps">
        <li><span><b>Read six sources.</b> Each reader asks one public database about the gene and turns the answer into a score from 0 to 1.</span></li>
        <li><span><b>Score the case.</b> The translation score is the weighted sum below. Under {THRESHOLD}, there is no case, and a receipt says which reader sank it.</span></li>
        <li><span><b>Check the merge.</b> The six findings are bound into one 1,024-number vector and pulled back out. If any finding can&apos;t be recovered, the run is not trusted.</span></li>
        <li><span><b>Write the experiment.</b> A gene, a cell type, both perturbation directions, a molecular and a functional readout, and the result that would rule it out.</span></li>
        <li><span><b>Seal, then test.</b> Predictions about the brain atlas are hashed before any data is read, tested on a random half of the donors, and must hold again on the other half.</span></li>
        <li><span><b>Open a case on failure.</b> Six analysts look at the failed test from different angles. Any better prediction they find is sealed and tested on a second brain region.</span></li>
      </ol>
      <div className="scroll-x" style={{ marginTop: 22 }}>
        <table className="table">
          <thead><tr><th>Reader</th><th>Source</th><th className="n">Weight</th></tr></thead>
          <tbody>
            {[...FACETS].sort((a, b) => WEIGHTS[b] - WEIGHTS[a]).map((f) => (
              <tr key={f}>
                <td>{FACET_LABEL[f]}</td>
                <td>{SOURCE[f]}{f === "lit" ? ", inverted: well-studied genes score low" : f === "clinic" ? ", lowered when trials were stopped" : f === "chem" ? " tractability and compounds" : ""}</td>
                <td className="n">{WEIGHTS[f].toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const fmtStat = (s: Experiment["discovery"]) => (s ? `${s.effect >= 0 ? "+" : ""}${s.effect.toFixed(2)} (p ${s.p < 0.001 ? s.p.toExponential(1) : s.p.toFixed(3)})` : "n/a");

export function ExperimentRows({ rows }: { rows: Experiment[] }) {
  if (!rows.length) return <p className="quiet">No predictions tested yet.</p>;
  const pinned = [...rows.filter((r) => r.passed), ...rows.filter((r) => !r.passed)].slice(0, 14);
  return (
    <ul className="rows">
      {pinned.map((r) => (
        <li key={r.registration} className={r.passed ? "pass" : ""}>
          <span><Link href={`/gene/${r.gene}`}><i className="g">{r.gene}</i></Link> in {r.group}, {r.axis}</span>
          <span className="nums">{fmtStat(r.discovery)} then {fmtStat(r.replication)}</span>
          <span className={`verdict ${r.passed ? "ok" : "no"}`}>
            {r.passed ? "replicated" : r.receipt ? <Link href={`/receipt/${r.receipt}`}>receipt {String(r.receipt).padStart(4, "0")}</Link> : r.state === "sealed" ? "sealed" : "failed"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SwarmCases({ cases }: { cases: SwarmCase[] }) {
  if (!cases.length) return <p className="quiet">No cases yet. The swarm opens one after the first failed atlas prediction.</p>;
  return (
    <>
      {cases.map((c) => (
        <article className="case" key={c.receipt}>
          <p className="h"><Link href={`/receipt/${c.receipt}`}>Receipt {String(c.receipt).padStart(4, "0")}</Link>: <i className="g">{c.gene}</i> in {c.group}, {c.axis}</p>
          <dl>{c.agents.map((a) => (<Fragment key={a.agent}><dt>{a.agent}</dt><dd>{a.said}</dd></Fragment>))}</dl>
          <p className="out"><b>{c.outcome}</b>{c.followups.map((f) => (<span key={f.registration} className="small quiet"><br />Follow-up {f.prediction}: {f.test}{f.reused ? " (already registered)" : ""}</span>))}</p>
        </article>
      ))}
    </>
  );
}
