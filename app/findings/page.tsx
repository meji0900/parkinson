import type { Metadata } from "next";
import Link from "next/link";
import { Funnel, Sec } from "@/components/sections";
import { AXIS_SHORT } from "@/lib/atlas/cohort";
import { ALPHA } from "@/lib/atlas/experiments";
import { fmtE, fmtP } from "@/lib/atlas/stats";
import { findings, funnel } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Findings",
  description: "Every sealed prediction that held, and the checks it went through: the cell mix, a second cohort or region, human genetics, compounds, and the sealed studies.",
};

const e2 = (x?: number) => (x == null ? "n/a" : fmtE(x));

export default function Findings() {
  const f = findings();
  const fun = funnel();
  const held = f.held;
  const pass = (ok: boolean | undefined) => (ok ? "hit" : "");
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Findings, computed from the live ledgers</p>
        <h1>The checks on the predictions that held.</h1>
        <p className="lede">
          A prediction that holds in both donor halves can still be wrong. In the nigra it can be survivorship: the dopamine neurons left in late
          disease are not the ones that were lost. It can be true in one region only. Or it can be true and still give a lab nothing to act on.
          Each check below takes on one of these.
        </p>
        <p className="stat-line">
          <b>{f.tested.toLocaleString("en")}</b> predictions tested, <b>{held.length}</b> held in both halves, <b>{f.composition.ok}</b> survive the
          cell-mix control, <b>{f.second.same}</b> point the same way in the {f.second_region}, <b>{f.second.strict}</b> clear the corrected bar.
          {f.simulated ? <> <span className="badge">simulated cohort</span></> : null}
        </p>
      </section>
      <Funnel stages={fun.stages} next={fun.next} links={false} />

      <article>
        <Sec id="composition" title="Is it the cells, or the mix of cells?">
          <p>
            As Parkinson&apos;s advances, the pigmented neurons of the nigra die, and glia take up more of what is left. A donor&apos;s average
            expression for &ldquo;dopamine neurons&rdquo; can then move with Lewy stage because of which neurons survive, without any neuron
            changing. Every prediction that held is recomputed on all {f.donors} donors with the cell group&apos;s share of each donor&apos;s nuclei
            controlled, along with age, sex and post-mortem interval.
          </p>
          {held.length ? (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>prediction</th><th className="m">halves</th><th className="m">mix controlled</th><th className="m">p</th></tr></thead>
                <tbody>
                  {held.map((e) => (
                    <tr key={e.registration}>
                      <td><Link href={`/gene/${e.gene}`}><i>{e.gene}</i></Link> in {e.group}, {AXIS_SHORT[e.axis]}</td>
                      <td className="m">{e2(e.discovery?.effect)} → {e2(e.replication?.effect)}</td>
                      <td className={`m ${pass(e.checks?.composition?.ok)}`}>{e2(e.checks?.composition?.effect)} {e.checks?.composition ? (e.checks.composition.ok ? "holds" : "lost") : ""}</td>
                      <td className="m">{e.checks?.composition ? fmtP(e.checks.composition.p) : "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="quiet small">Nothing has held yet. Most predictions fail; the receipts show how.</p>}
          <p className="cs-limit">limit: the control is the group&apos;s share of nuclei, not a count of neurons in tissue; shifts among dopamine-neuron subtypes (the SOX6/AGTR1 cells are the most depleted) happen inside the group and are not covered.</p>
        </Sec>

        <Sec id="second" title={f.second_kind === "region" ? `A second region: the ${f.second_region}` : `A second cohort: the ${f.second_region}`}>
          {f.second_kind === "region" ? (
            <p>
              Each prediction that held is tested once more in the {f.second_region} ({f.second_donors} donors), with the direction it must take
              written down first. The ventral tegmental area sits beside the substantia nigra and holds dopamine neurons too, but Parkinson&apos;s
              largely spares it, so a gene that moves the same way in both is a disease-wide signal and one that moves only in the nigra may be
              about vulnerability. The strict bar divides 0.05 by the number of predictions that held: p &lt; {fmtP(f.strict_alpha)}.
            </p>
          ) : (
            <p>
              Each prediction that held is tested once more in other people: the {f.second_region}, {f.second_donors} donors from a different brain
              bank, sequenced by another lab with another method, with the direction it must take written down first. That cohort has no Lewy-body
              staging, so a prediction about the stage is checked as {f.second_proxy}: a gene that moves with the disease&apos;s progress should differ
              between patients and controls, the same way. Resilience needs staged donors and is not checked there. The strict bar divides 0.05 by
              the number of predictions that held: p &lt; {fmtP(f.strict_alpha)}.
            </p>
          )}
          <pre className="ascii">{[
            `${String(held.length).padStart(4)}  held in the ${f.region}`,
            `${String(f.second.measured).padStart(4)}  testable in the ${f.second_region}`,
            `${String(f.second.same).padStart(4)}  point the same way`,
            `${String(f.second.nominal).padStart(4)}  at p < ${ALPHA}`,
            `${String(f.second.strict).padStart(4)}  at p < ${fmtP(f.strict_alpha)}`,
          ].join("\n")}</pre>
          {held.length > 0 && (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>prediction</th><th className="m">first</th><th className="m">{f.second_kind === "region" ? "second region" : "second cohort"}</th><th className="m">p</th></tr></thead>
                <tbody>
                  {held.map((e) => (
                    <tr key={e.registration}>
                      <td><Link href={`/gene/${e.gene}`}><i>{e.gene}</i></Link> in {e.group}, {AXIS_SHORT[e.axis]}</td>
                      <td className="m">{e2(e.discovery?.effect)}</td>
                      <td className={`m ${e.checks?.second?.same_sign && e.checks.second.p < f.strict_alpha ? "hit" : ""}`}>{e.checks?.second ? `${e2(e.checks.second.effect)} ${e.checks.second.same_sign ? "same way" : "flipped"}${e.checks.second.proxy ? " (PD vs controls)" : ""}` : "not testable there"}</td>
                      <td className="m">{e.checks?.second ? fmtP(e.checks.second.p) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="cs-limit">
            {f.second_kind === "region"
              ? "limit: largely the same donors in both regions; this is consistency within a cohort, not replication in new people."
              : `limit: new people, but few of them (${f.second_donors}), and a stage prediction is checked only as patients against controls; dopamine neurons in that cohort come mostly from sorted libraries.`}
          </p>
        </Sec>

        <Sec id="genetics" title="Does human genetics already point at these genes?">
          <p>
            Everything above is association: a gene&apos;s activity moves with the disease. Human genetics can say something about cause. For each
            gene that held, the genetic-association score from Open Targets is read from the agent&apos;s last reading of it, and compared with
            the genes it tested that never held. The agent picks its genes from a genetics-ranked list, so both groups start enriched; the
            comparison between them is what counts.
          </p>
          <pre className="ascii">{[
            `held        ${f.genetics.held.supported} of ${f.genetics.held.read} genes with genetic support (score ≥ 0.1)`,
            `never held  ${f.genetics.never.supported} of ${f.genetics.never.read}`,
            `Fisher exact test  ${f.genetics.p == null ? "n/a" : `p ${fmtP(f.genetics.p)}`}`,
          ].join("\n")}</pre>
          {f.genetics.rows.length > 0 && (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>gene</th><th className="r">genetic association</th><th className="r">overall</th></tr></thead>
                <tbody>{f.genetics.rows.map((r) => (
                  <tr key={r.gene}><td><Link href={`/gene/${r.gene}`}><i>{r.gene}</i></Link></td><td className="r">{r.genetics?.toFixed(2) ?? "not read"}</td><td className="r">{r.overall?.toFixed(2) ?? ""}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="cs-limit">limit: an association score is not a direction; a variant can act through a neighbouring gene.</p>
        </Sec>

        <Sec id="drugs" title="Does anything already act on these genes?">
          <p>
            For each gene with a prediction that held, the compounds and their mechanisms come from Open Targets. If a gene goes the way the
            disease goes, an inhibitor would push it back; if it goes the other way, an activator would. Mechanisms that push against the disease
            direction are marked. That does not say the change is harmful: it may be the cell&apos;s defence, and reversing it could make things
            worse. It is a list of where a lab could look first.
          </p>
          {f.drugs.length ? f.drugs.map((d) => (
            <div className="drug" key={d.gene}>
              <h3><Link href={`/gene/${d.gene}`}><i>{d.gene}</i></Link> <span className="mono">{d.group}, {AXIS_SHORT[d.axis]}, goes {d.sign > 0 ? "with" : "against"} the disease</span></h3>
              <p>{d.drugs.slice(0, 8).join(", ").toLowerCase()}{d.n_drugs > 8 ? ` and ${d.n_drugs - 8} more` : ""}</p>
              <p className="mono">{d.actions.map((a) => `${a.action} ×${a.n}${a.against ? " (against the disease direction)" : ""}`).join("; ") || "no mechanism listed"}</p>
            </div>
          )) : <p className="quiet small">No compound acts on a gene that held yet.</p>}
        </Sec>

        <Sec id="studies" title="Studies the agent ran">
          <p>
            These run inside the agent&apos;s own loop. Each study is taken from a queue between genes, sealed before its data is read, and posted
            step by step to the live feed. A study that misses its sealed rule prints a receipt. <Link href="/program">The lysosome program</Link>{" "}
            has the full write-up.
          </p>
          {f.studies.length ? (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>study</th><th className="m">discovery</th><th className="m">held-out</th><th className="m">random sets</th><th>verdict</th></tr></thead>
                <tbody>{f.studies.map((s) => (
                  <tr key={s.registration}>
                    <td><Link href={`/program#${s.id}`}>{s.def.title}</Link></td>
                    <td className="m">{s.result ? `${fmtE(s.result.discovery.effect)} p ${fmtP(s.result.discovery.p)}` : "sealed"}</td>
                    <td className="m">{s.result ? `${fmtE(s.result.replication.effect)} p ${fmtP(s.result.replication.p)}` : ""}</td>
                    <td className="m">{s.result?.random.n ? `${s.result.random.beaten}/${s.result.random.n}` : ""}</td>
                    <td className={s.result?.passed ? "hit" : "miss"}>{s.result ? (s.result.passed ? "held" : s.receipt ? <Link href={`/receipt/${s.receipt}`}>receipt {String(s.receipt).padStart(4, "0")}</Link> : "missed") : "running"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="quiet small">No study has run yet; the first runs after the agent&apos;s first gene.</p>}
        </Sec>

        <Sec id="sources-of" title="Who predicted">
          <p>The agent, visitors, wallets and other agents run the same test. A prediction registered twice is tested once.</p>
          <table className="tbl">
            <thead><tr><th>source</th><th className="r">tested</th><th className="r">held</th></tr></thead>
            <tbody>{f.by_source.map((r) => <tr key={r.source}><td>{r.source}</td><td className="r">{r.n.toLocaleString("en")}</td><td className="r">{r.held}</td></tr>)}</tbody>
          </table>
        </Sec>

        <Sec id="genes" title="Every gene that held">
          <p>Each gene has a page with every test, receipt, swarm case and study on record.</p>
          <form className="gene-search" action="/gene"><input name="g" maxLength={16} placeholder="any gene, e.g. LRRK2" aria-label="Gene symbol" spellCheck={false} /><button type="submit">open</button></form>
          {held.length ? (
            <ul className="gene-list">{[...new Set(held.map((e) => e.gene))].sort().map((g) => <li key={g} className="held"><Link href={`/gene/${g}`}>{g}</Link></li>)}</ul>
          ) : <p className="quiet small">None yet.</p>}
        </Sec>
      </article>
    </main>
  );
}
