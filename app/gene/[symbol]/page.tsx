import type { Metadata } from "next";
import Link from "next/link";
import { Proposal } from "@/components/proposal";
import { ReceiptStrip } from "@/components/receipts";
import { Replay } from "@/components/replay";
import { ExperimentRows, Sec, SwarmCases } from "@/components/sections";
import { FACET_LABEL, FACETS, SOURCE } from "@/lib/agent/types";
import { STUDIES } from "@/lib/atlas/studies";
import { cleanGene } from "@/lib/server/api";
import { geneRecord } from "@/lib/views";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = cleanGene((await params).symbol);
  return { title: g, description: `Everything the agent has on record for ${g}: six-source reading, proposal, sealed predictions, receipts and studies.` };
}

export default async function GenePage({ params }: Props) {
  const g = cleanGene((await params).symbol);
  const rec = geneRecord(g);
  const r = rec.latest;
  const held = rec.experiments.filter((e) => e.passed).length;
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Gene record</p>
        <h1><i>{g}</i></h1>
        {r?.name ? <p className="lede">{r.name}</p> : null}
        <form className="gene-search" action="/gene"><input name="g" maxLength={16} placeholder="another gene" aria-label="Gene symbol" spellCheck={false} /><button type="submit">open</button></form>
        <p className="stat-line">
          {r ? <>translation score <b>{r.score.toFixed(2)}</b>, read {r.at.slice(0, 10)}; </> : "not read yet; "}
          <b>{rec.experiments.length}</b> sealed predictions, <b>{held}</b> held; <b>{rec.receipts.length}</b> receipts.{" "}
          <Replay gene={g} className="copy">{r ? "read it again" : "read it now"}</Replay>
        </p>
      </section>
      <article>
        {r && (
          <Sec title="Six readers">
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>reader</th><th>found</th><th className="r">score</th></tr></thead>
                <tbody>
                  {FACETS.map((f) => (
                    <tr key={f}>
                      <td>{FACET_LABEL[f]}<br /><span className="small quiet">{SOURCE[f]}</span></td>
                      <td>{r.findings[f].summary}{r.findings[f].error ? <span className="err small"> ({r.findings[f].error})</span> : null}</td>
                      <td className="r">{r.findings[f].score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.hypothesis ? <Proposal hyp={r.hypothesis} gene={g} /> : <p>No case: the score is under the bar. {r.receipt ? <Link href={`/receipt/${r.receipt}`}>Receipt {String(r.receipt).padStart(4, "0")}</Link> : null}</p>}
            {rec.history.length > 1 && <p className="small quiet">Earlier readings: {rec.history.slice(1).map((h) => `${h.at.slice(0, 10)} ${h.score.toFixed(2)}`).join("; ")}.</p>}
          </Sec>
        )}
        <Sec title="Sealed predictions">
          <ExperimentRows rows={rec.experiments} limit={40} />
        </Sec>
        {(rec.studies.length > 0 || rec.planned.length > 0) && (
          <Sec title="In the sealed studies">
            <ul className="limits">
              {rec.planned.map((id) => {
                const d = STUDIES.find((s) => s.id === id)!;
                const s = rec.studies.find((x) => x.id === id);
                return <li key={id}><Link href={`/program#${id}`}>{d.title}</Link>: {s ? (s.state === "done" ? (s.passed ? "held" : "did not hold") : "sealed") : "queued"}</li>;
              })}
            </ul>
          </Sec>
        )}
        <Sec title="Swarm cases"><SwarmCases cases={rec.swarm} /></Sec>
        <Sec title="Receipts">
          <ReceiptStrip gene={g} limit={24} />
        </Sec>
      </article>
    </main>
  );
}
