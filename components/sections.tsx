// Home page sections and the pieces the inner pages share, rendered on the server from the ledgers.
import Link from "next/link";
import { Fragment } from "react";
import type { Hypothesis, RunRecord } from "@/lib/agent/types";
import { FACET_LABEL, FACETS, SOURCE, THRESHOLD, WEIGHTS } from "@/lib/agent/types";
import type { Experiment } from "@/lib/atlas/experiments";
import type { SwarmCase } from "@/lib/atlas/swarm";
import { Replay } from "./replay";

const slug = (t: React.ReactNode) => (typeof t === "string" ? t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined);

/** A section of a page. Its order shows in the rail beside the text, so headings carry no numbers. */
export function Sec({ id, title, rail, children, className = "" }: { id?: string; title: React.ReactNode; rail?: string; children: React.ReactNode; className?: string }) {
  const sid = id ?? slug(title);
  return (
    <section className={`sec ${className}`.trim()} id={sid} data-rail={rail} aria-labelledby={sid ? `${sid}-h` : undefined}>
      <h2 id={sid ? `${sid}-h` : undefined}>{title}</h2>
      {children}
    </section>
  );
}

export function Plate({ src, alt, w, h, children, wide = false }: { src: string; alt: string; w: number; h: number; children: React.ReactNode; wide?: boolean }) {
  return (
    <figure className={`plate${wide ? " wide" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp files; next/image adds nothing here */}
      <img src={src} width={w} height={h} alt={alt} loading="lazy" decoding="async" />
      <figcaption>{children}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- the pipeline
// Every stage a prediction passes, left to right, as a descending stair: each step's height is the stage's
// count on a log scale, so the drop from thousands sealed to a handful confirmed reads at a glance.
const height = (n: number, max: number) => `${Math.max(4, (100 * Math.log10(n + 1)) / Math.log10(max + 1))}%`;

type Stage = { key: string; n: number; label: string; of?: number };
export function Funnel({ stages, next, links = true, note }: { stages: Stage[]; next?: Stage; links?: boolean; note?: React.ReactNode }) {
  const max = Math.max(1, ...stages.map((s) => s.n));
  return (
    <section className="band" aria-label="Where the predictions stand">
      <ol className="pipeline">
        {stages.map((s, i) => (
          <li key={s.key} className={i === stages.length - 1 ? "last" : ""}>
            <span className="track" aria-hidden><span className="step" style={{ height: height(s.n, max) }} /></span>
            <span className="pn">{s.n.toLocaleString("en")}</span>
            <span className="pl">
              {links && s.key === "tested" ? <Link href="/findings">{s.label}</Link> : s.label}
              {s.of != null && s.of !== s.n ? <> (of {s.of})</> : null}
            </span>
          </li>
        ))}
        {next && (
          <li className="next">
            <span className="track" aria-hidden><span className="step" /></span>
            <span className="pn">{next.n}</span>
            <span className="pl">{next.label}</span>
          </li>
        )}
      </ol>
      {note && <p className="band-note">{note}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- the notebook
const bar = (v: number, w = 22) => {
  const x = Math.max(0, Math.min(1, v)) * w;
  const full = Math.floor(x);
  return ("█".repeat(full) + (x - full >= 0.5 ? "▌" : "")).padEnd(w, " ");
};

export function NotebookEntries({ entries }: { entries: { symbol: string; name: string; at: string; hypothesis: Hypothesis }[] }) {
  if (!entries.length) return <p className="quiet">No proposals yet. The agent writes one whenever a gene clears a translation score of {THRESHOLD}.</p>;
  return (
    <ol className="entries">
      {entries.map((e) => (
        <li key={e.symbol}>
          <div className="e-head">
            <h3><Link href={`/gene/${e.symbol}`}><i>{e.symbol}</i></Link> in {e.hypothesis.cell}</h3>
            <span className="e-score">{e.hypothesis.score.toFixed(2)}</span>
          </div>
          <p className="e-text">{e.hypothesis.statement}</p>
          <pre className="e-bars" aria-label="What each reader found">
            {FACETS.map((f) => `${FACET_LABEL[f].padEnd(11)} ${bar(e.hypothesis.scores[f] ?? 0)} ${(e.hypothesis.scores[f] ?? 0).toFixed(2)}`).join("\n")}
          </pre>
          <p className="e-foot">
            <span>{e.hypothesis.dissent.length ? `dissent: ${e.hypothesis.dissent.map((f) => FACET_LABEL[f]).join(", ")}` : "no reader dissented"}</span>
            <span>{e.name}</span>
            <Replay gene={e.symbol}>replay</Replay>
          </p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- the method
const MEASURES: Record<string, string> = {
  genetics: "genetic association with Parkinson's",
  lit: "papers pairing the gene with Parkinson's or α-synuclein, inverted",
  cell: "enrichment in dopamine neurons (the midbrain), astrocytes or microglia",
  path: "membership of pathways implicated by genetics: mitophagy, the lysosome, vesicle traffic, the dopamine synapse",
  chem: "small-molecule or antibody tractability, and compounds that already reach it",
  clinic: "prior Parkinson's trials, penalised if stopped",
};

export function Weights() {
  return (
    <div className="scroll-x">
      <table className="weights">
        <thead><tr><th>score</th><th>source</th><th>measures</th><th className="r">weight</th></tr></thead>
        <tbody>
          {[...FACETS].sort((a, b) => WEIGHTS[b] - WEIGHTS[a]).map((f) => (
            <tr key={f}><td>{FACET_LABEL[f]}</td><td>{SOURCE[f]}</td><td>{MEASURES[f]}</td><td className="r">{WEIGHTS[f].toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** recovery of each finding from the last combined vector */
export function Merged({ run }: { run: RunRecord | null }) {
  if (!run) return <pre className="ascii">no run yet</pre>;
  const order = FACETS;
  const lines = order.map((f, i) => {
    const r = run.merge.recovered[f];
    const joint = i === 0 ? "─╮" : i === order.length - 1 ? "─╯" : i === 2 ? "─┼─▶ ◉" : "─┤";
    return `${FACET_LABEL[f].padStart(11)} ${joint}`.padEnd(21) + `${run.findings[f].level.padEnd(9)} cos ${r.cos.toFixed(2)}  next ${r.next.toFixed(2)}${r.ok ? "" : "  lost"}`;
  });
  return (
    <figure>
      <pre className="ascii" aria-label={`Merge check for ${run.symbol}`}>{`${run.symbol}, sha ${run.merge.sha}\n\n${lines.join("\n")}`}</pre>
      <figcaption>recovery of each finding from the last combined vector ({run.symbol}, {run.at.slice(0, 16).replace("T", " ")} UTC): cosine with the right finding, and with the closest wrong one</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- ledgers
const fmtStat = (s: Experiment["discovery"]) => (s ? `${s.effect >= 0 ? "+" : ""}${s.effect.toFixed(2)} (p ${s.p < 0.001 ? s.p.toExponential(1) : s.p.toFixed(3)})` : "n/a");

export function ExperimentRows({ rows, limit = 14 }: { rows: Experiment[]; limit?: number }) {
  if (!rows.length) return <p className="quiet small">No predictions tested yet.</p>;
  const pinned = [...rows.filter((r) => r.passed), ...rows.filter((r) => !r.passed)].slice(0, limit);
  return (
    <ol className="experiments">
      {pinned.map((r) => (
        <li key={r.registration} className={r.passed ? "pass" : ""}>
          <span className="ex-gene"><Link href={`/gene/${r.gene}`}><i>{r.gene}</i></Link> in {r.group}, {r.axis}</span>
          <span className="ex-nums">{fmtStat(r.discovery)} → {fmtStat(r.replication)}</span>
          <span className="ex-verdict">
            {r.passed ? "held" : r.receipt ? <Link href={`/receipt/${r.receipt}`}>receipt {String(r.receipt).padStart(4, "0")}</Link> : r.state === "sealed" ? "sealed" : "failed"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SwarmCases({ cases }: { cases: SwarmCase[] }) {
  if (!cases.length) return <p className="quiet small">No cases yet. The swarm opens one after the first failed atlas prediction.</p>;
  return (
    <>
      {cases.map((c) => (
        <article className="case" key={c.receipt}>
          <p className="case-head"><Link href={`/receipt/${c.receipt}`}>receipt {String(c.receipt).padStart(4, "0")}</Link>: <i>{c.gene}</i> in {c.group}, {c.axis}</p>
          <dl className="case-agents">{c.agents.map((a, i) => (<Fragment key={`${a.agent}-${i}`}><dt>{a.agent}</dt><dd>{a.said}</dd></Fragment>))}</dl>
          <p className="case-out">
            <b>{c.outcome}</b>
            {c.followups.map((f) => (<span key={f.registration} className="mono"><br />follow-up {f.prediction}: {f.test}{f.reused ? " (already registered)" : ""}</span>))}
          </p>
        </article>
      ))}
    </>
  );
}
