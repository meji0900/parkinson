import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sec } from "@/components/sections";
import { cleanGene } from "@/lib/server/api";
import { geneIndex } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Genes", description: "Every gene the agent has read or tested, with its translation score and sealed predictions." };

export default async function GeneIndex({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const g = cleanGene((await searchParams).g);
  if (g) redirect(`/gene/${g}`);
  const { genes, held } = geneIndex();
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Gene records</p>
        <h1>Every gene on record.</h1>
        <p className="lede">Each gene has a page with its six-source reading, its proposal or receipt, every sealed prediction, swarm case and study.</p>
        <form className="gene-search" action="/gene"><input name="g" maxLength={16} placeholder="any gene, e.g. GBA1" aria-label="Gene symbol" spellCheck={false} /><button type="submit">open</button></form>
        <p className="stat-line"><b>{genes.length.toLocaleString("en")}</b> genes, <b>{held.length}</b> with a prediction that held.</p>
      </section>
      <article>
        <Sec title="Held in both halves">
          {held.length ? <ul className="gene-list">{held.map((x) => <li key={x.symbol} className="held"><Link href={`/gene/${x.symbol}`}>{x.symbol}</Link></li>)}</ul> : <p className="quiet small">None yet.</p>}
        </Sec>
        <Sec title="All genes">
          {genes.length ? (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>gene</th><th>name</th><th className="r">score</th><th className="r">tested</th><th className="r">held</th></tr></thead>
                <tbody>{genes.map((x) => (
                  <tr key={x.symbol}>
                    <td><Link href={`/gene/${x.symbol}`}><i>{x.symbol}</i></Link></td>
                    <td className="small">{x.name}</td>
                    <td className="r">{Number.isFinite(x.score) ? x.score.toFixed(2) : ""}</td>
                    <td className="r">{x.tested}</td>
                    <td className={`r ${x.held ? "hit" : ""}`}>{x.held}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="quiet small">No genes yet. <Link href="/#live">Give the agent one.</Link></p>}
        </Sec>
      </article>
    </main>
  );
}
