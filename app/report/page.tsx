import type { Metadata } from "next";
import Link from "next/link";
import { CopyText } from "@/components/copy-text";
import { Entry } from "@/components/sections";
import { report, reportDays } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily report", description: "What the agent did in one UTC day, counted from its ledgers." };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const q = (await searchParams).day;
  const day = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Date().toISOString().slice(0, 10);
  const r = report(day);
  const days = reportDays();
  const cells: [string, number][] = [
    ["genes read", r.genes], ["lab proposals", r.proposals], ["receipts", r.receipts],
    ["sealed predictions tested", r.tested], ["held in both halves", r.held], ["swarm cases", r.cases], ["predictions from visitors and agents", r.visitors],
  ];
  return (
    <main className="page">
      <header className="phead">
        <p className="quiet" style={{ margin: 0 }}>Daily report, UTC</p>
        <h1>{day === new Date().toISOString().slice(0, 10) ? "Today, so far." : day}</h1>
        <p>What the agent did in one day, counted from its ledgers. Today&apos;s report updates as it works.</p>
      </header>
      <Entry note="The day in numbers">
        <table className="table"><tbody>{cells.map(([k, v]) => <tr key={k}><td>{k}</td><td className="n">{v.toLocaleString("en")}</td></tr>)}</tbody></table>
        {r.held_rows.length > 0 && (
          <p className="small" style={{ marginTop: 14 }}>
            Held: {r.held_rows.map((h, i) => <span key={i}>{i ? "; " : ""}<Link href={`/gene/${h.gene}`}><i className="g">{h.gene}</i></Link> in {h.grp}, {h.axis}</span>)}.
          </p>
        )}
      </Entry>
      <Entry note="As a post" sub="Ready to paste.">
        <pre className="code" style={{ whiteSpace: "pre-wrap" }}>{r.post}</pre>
        <CopyText text={r.post} />
      </Entry>
      <Entry note="Other days">
        {days.length ? (
          <ul className="rows">{days.map((d) => <li key={d.day}><Link href={`/report?day=${d.day}`}>{d.day}</Link><span className="nums">{d.n} runs</span><span /></li>)}</ul>
        ) : <p className="quiet">No days on record yet.</p>}
      </Entry>
    </main>
  );
}
