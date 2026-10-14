import type { Metadata } from "next";
import Link from "next/link";
import { Entry } from "@/components/sections";
import { listExperiments } from "@/lib/atlas/experiments";
import { atlasInfo, funnel } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Findings", description: "Every sealed prediction, and how many survive each check, computed live from the ledgers." };

const w = (n: number, max: number) => `${Math.max(1.5, (100 * Math.log10(n + 1)) / Math.log10(max + 1))}%`;
const e2 = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;
const p3 = (p: number) => (p < 0.001 ? p.toExponential(1) : p.toFixed(3));

export default function Findings() {
  const f = funnel();
  const atlas = atlasInfo();
  const max = Math.max(1, ...f.stages.map((s) => s.n));
  const held = listExperiments({ limit: 2000 }).filter((e) => e.passed);
  return (
    <main className="page">
      <header className="phead">
        <h1>What held, and how many checks it survived.</h1>
        <p className="lede">
          A prediction that holds in both donor halves can still be wrong: an artefact of which cells survive the disease, true in
          one brain region only, or too weak to survive correction for everything else that was tested. Each line below is one more check.
        </p>
      </header>
      <Entry note="The funnel" sub="Computed from the ledgers on every page load.">
        {atlas.simulated && (
          <div className="sim" role="note"><span><b>Simulated cohort.</b> These counts come from generated data shaped like SEA-AD. They show the method working, not biology.</span></div>
        )}
        <ol className="funnel">
          {f.stages.map((s, i) => (
            <li key={s.key} className={i === f.stages.length - 1 ? "last" : ""}>
              <span className="n">{s.n.toLocaleString("en")}</span>
              <span className="lab">{s.label}{"of" in s && s.of != null && s.of !== s.n ? <span className="quiet"> (of {s.of})</span> : null}</span>
              <span className="track" aria-hidden><i style={{ width: w(s.n, max) }} /></span>
            </li>
          ))}
        </ol>
        <p className="small quiet" style={{ marginTop: 18 }}>
          {f.receipts.toLocaleString("en")} receipts. Swarm: {f.swarm.count} cases, {f.swarm.followups} follow-ups sealed, {f.swarm.same_sign} pointing the same way in the second region, {f.swarm.confirmed} confirmed.
        </p>
      </Entry>
      <Entry note="Who predicted" sub="The agent, visitors, wallets and other agents run the same test.">
        <table className="table">
          <thead><tr><th>Source</th><th className="n">Tested</th><th className="n">Held</th></tr></thead>
          <tbody>
            {f.by_source.map((r) => (
              <tr key={r.source}><td>{r.source}</td><td className="n">{r.n}</td><td className="n">{r.held}</td></tr>
            ))}
          </tbody>
        </table>
      </Entry>
      <Entry note="Held in both halves" sub="With the two confirmation checks run automatically on each.">
        {!held.length ? (
          <p className="quiet">Nothing has held yet. Most predictions fail; the receipts show how.</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Prediction</th><th>Halves</th><th>Cell mix controlled</th><th>Second region</th></tr></thead>
              <tbody>
                {held.slice(0, 120).map((e) => (
                  <tr key={e.registration}>
                    <td><Link href={`/gene/${e.gene}`}><i className="g">{e.gene}</i></Link> in {e.group}, {e.axis}</td>
                    <td className="mono">{e2(e.discovery!.effect)} then {e2(e.replication!.effect)}</td>
                    <td className="mono">{e.checks?.composition ? `${e2(e.checks.composition.effect)} p ${p3(e.checks.composition.p)} ${e.checks.composition.ok ? "✓" : "✗"}` : "n/a"}</td>
                    <td className="mono">{e.checks?.second ? `${e2(e.checks.second.effect)} p ${p3(e.checks.second.p)} ${e.checks.second.same_sign ? "same way" : "flipped"}` : "not measured"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Entry>
    </main>
  );
}
