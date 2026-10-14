import type { Metadata } from "next";
import Link from "next/link";
import { Proposal } from "@/components/proposal";
import { ReceiptStrip } from "@/components/receipts";
import { Replay } from "@/components/replay";
import { Entry, ExperimentRows, SwarmCases } from "@/components/sections";
import { FACET_LABEL, FACETS, SOURCE } from "@/lib/agent/types";
import { cleanGene } from "@/lib/server/api";
import { geneRecord } from "@/lib/views";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = cleanGene((await params).symbol);
  return { title: g, description: `Everything the agent has on record for ${g}: six-source reading, proposal, sealed predictions and receipts.` };
}

export default async function GenePage({ params }: Props) {
  const g = cleanGene((await params).symbol);
  const rec = geneRecord(g);
  const r = rec.latest;
  return (
    <main className="page">
      <header className="phead">
        <p className="quiet" style={{ margin: 0 }}>Gene record</p>
        <h1><i className="g">{g}</i>{r?.name ? <span className="quiet" style={{ fontSize: "0.5em", fontWeight: 400, display: "block", marginTop: 8 }}>{r.name}</span> : null}</h1>
        <p style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {r ? <span>Translation score <b>{r.score.toFixed(2)}</b>, read {r.at.slice(0, 10)}.</span> : <span>Not read yet.</span>}
          <Replay gene={g}>{r ? "Read it again" : "Read it now"}</Replay>
        </p>
      </header>
      {r && (
        <Entry note="Six readers" sub="Latest reading, from the public sources.">
          <table className="table">
            <thead><tr><th>Reader</th><th>Found</th><th className="n">Score</th></tr></thead>
            <tbody>
              {FACETS.map((f) => (
                <tr key={f}>
                  <td>{FACET_LABEL[f]}<br /><span className="small quiet">{SOURCE[f]}</span></td>
                  <td>{r.findings[f].summary}{r.findings[f].error ? <span className="err small"> ({r.findings[f].error})</span> : null}</td>
                  <td className="n">{r.findings[f].score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.hypothesis ? <Proposal hyp={r.hypothesis} gene={g} /> : <p style={{ marginTop: 16 }}>No case: the score is under the bar. {r.receipt ? <Link href={`/receipt/${r.receipt}`}>Receipt {String(r.receipt).padStart(4, "0")}</Link> : null}</p>}
          {rec.history.length > 1 && (
            <p className="small quiet" style={{ marginTop: 14 }}>Earlier readings: {rec.history.slice(1).map((h) => `${h.at.slice(0, 10)} ${h.score.toFixed(2)}`).join("; ")}.</p>
          )}
        </Entry>
      )}
      <Entry note="Sealed predictions" sub="Tested on held-out donors.">
        <ExperimentRows rows={rec.experiments} />
      </Entry>
      <Entry note="Swarm cases"><SwarmCases cases={rec.swarm} /></Entry>
      <Entry note="Receipts" wide={<ReceiptStrip gene={g} />}><p className="quiet">Every receipt printed for <i className="g">{g}</i>, checked in this browser.</p></Entry>
    </main>
  );
}
