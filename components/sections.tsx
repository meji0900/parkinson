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
// Every stage a prediction passes, drawn as the same patch of substantia nigra losing its pigmented neurons, the
// way Parkinson's empties the nigra. The share of neurons still pigmented is the stage's count on a log scale;
// where one is lost, a glial nucleus is left. The exact count is printed under each patch.
const PATCH = { w: 140, h: 70, cx: 70, cy: 35, rx: 66, ry: 31 };

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** one fixed patch for every stage: neurons on a jittered hex grid inside the section, in the order they will be lost */
const NEURONS = (() => {
  const r = rng(1817);
  const cells: (Cell & { order: number })[] = [];
  for (let row = 0, y = 7; y < PATCH.h - 5; row++, y += 9.6) {
    for (let x = 7 + (row % 2) * 5.5; x < PATCH.w - 5; x += 11) {
      const jx = x + (r() - 0.5) * 4, jy = y + (r() - 0.5) * 3.6;
      if (((jx - PATCH.cx) / (PATCH.rx - 4)) ** 2 + ((jy - PATCH.cy) / (PATCH.ry - 3)) ** 2 > 1) continue;
      cells.push({ x: jx, y: jy, rx: 3.4 + r() * 1.3, ry: 2.6 + r() * 0.8, a: r() * 180, gx: (r() - 0.5) * 3, gy: (r() - 0.5) * 3, order: r() });
    }
  }
  return cells.sort((a, b) => b.order - a.order);
})();

type Cell = { x: number; y: number; rx: number; ry: number; a: number; gx: number; gy: number };

/** a pigmented nigral neuron: brown soma, darker neuromelanin granules, a pale nucleus to one side */
function Neuron({ c }: { c: Cell }) {
  return (
    <g transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${c.a.toFixed(0)})`}>
      <ellipse className="soma" rx={c.rx.toFixed(1)} ry={c.ry.toFixed(1)} />
      <circle className="melanin" cx={(c.rx * 0.3).toFixed(1)} cy={(-c.ry * 0.25).toFixed(1)} r={(c.ry * 0.38).toFixed(1)} />
      <circle className="melanin" cx={(c.rx * 0.05).toFixed(1)} cy={(c.ry * 0.4).toFixed(1)} r={(c.ry * 0.3).toFixed(1)} />
      <circle className="nucleus" cx={(-c.rx * 0.42).toFixed(1)} r={(c.ry * 0.36).toFixed(1)} />
    </g>
  );
}

function NigraPatch({ share, empty = false }: { share: number; empty?: boolean }) {
  const kept = share <= 0 ? 0 : Math.max(1, Math.round(share * NEURONS.length));
  return (
    <svg className="patch" viewBox={`0 0 ${PATCH.w} ${PATCH.h}`} preserveAspectRatio="xMinYMid meet" aria-hidden>
      <ellipse className={empty ? "section empty" : "section"} cx={PATCH.cx} cy={PATCH.cy} rx={PATCH.rx} ry={PATCH.ry} />
      {!empty && NEURONS.map((c, i) =>
        i < kept ? (
          <Neuron key={i} c={c} />
        ) : (
          <circle key={i} className="glia" cx={(c.x + c.gx).toFixed(1)} cy={(c.y + c.gy).toFixed(1)} r="1.3" />
        ),
      )}
    </svg>
  );
}

// A score from 0 to 1 as a row of twelve nigral neurons: the pigmented ones are the score, the rest have lost their
// pigment and left a glial nucleus. The same twelve cells in every row, so the rows line up like a bar chart.
const STRIP: Cell[] = (() => {
  const r = rng(1755);
  return Array.from({ length: 12 }, (_, i) => ({
    x: 6 + i * 11, y: 6 + (r() - 0.5) * 1.4, rx: 4 + r() * 0.8, ry: 3 + r() * 0.5, a: (r() - 0.5) * 50, gx: (r() - 0.5) * 2.4, gy: (r() - 0.5) * 2,
  }));
})();

export function CellStrip({ value }: { value: number }) {
  const kept = Math.round(Math.max(0, Math.min(1, value)) * STRIP.length);
  return (
    <svg className="strip" viewBox="0 0 132 12" aria-hidden>
      {STRIP.map((c, i) =>
        i < kept ? (
          <Neuron key={i} c={c} />
        ) : (
          <g key={i}>
            <ellipse className="ghost" cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} rx={c.rx.toFixed(1)} ry={c.ry.toFixed(1)} transform={`rotate(${c.a.toFixed(0)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`} />
            <circle className="glia" cx={(c.x + c.gx).toFixed(1)} cy={(c.y + c.gy).toFixed(1)} r="1.2" />
          </g>
        ),
      )}
    </svg>
  );
}

const share = (n: number, max: number) => (n <= 0 ? 0 : Math.log10(n + 1) / Math.log10(max + 1));

type Stage = { key: string; n: number; label: string; of?: number };
export function Funnel({ stages, next, links = true, note }: { stages: Stage[]; next?: Stage; links?: boolean; note?: React.ReactNode }) {
  const max = Math.max(1, ...stages.map((s) => s.n));
  return (
    <section className="band" aria-label="Where the predictions stand">
      <ol className="pipeline">
        {stages.map((s, i) => (
          <li key={s.key} className={i === stages.length - 1 ? "last" : ""}>
            <span className="track"><NigraPatch share={share(s.n, max)} /></span>
            <span className="pn">{s.n.toLocaleString("en")}</span>
            <span className="pl">
              {links && s.key === "tested" ? <Link href="/findings">{s.label}</Link> : s.label}
              {s.of != null && s.of !== s.n ? <> (of {s.of})</> : null}
            </span>
          </li>
        ))}
        {next && (
          <li className="next">
            <span className="track"><NigraPatch share={0} empty /></span>
            <span className="pn">{next.n}</span>
            <span className="pl">{next.label}</span>
          </li>
        )}
      </ol>
      <p className="band-note">
        each patch is the same piece of nigra: the pigmented neurons left show the count on a log scale, blue dots are glia where they died
        {note ? <>; {note}</> : null}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- the notebook
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
          <dl className="e-cells" aria-label="What each reader found">
            {FACETS.map((f) => {
              const v = e.hypothesis.scores[f] ?? 0;
              return <div key={f}><dt>{FACET_LABEL[f]}</dt><dd><CellStrip value={v} /><span>{v.toFixed(2)}</span></dd></div>;
            })}
          </dl>
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
