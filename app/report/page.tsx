import type { Metadata } from "next";
import Link from "next/link";
import { CopyText } from "@/components/copy-text";
import { Sec } from "@/components/sections";
import { report, reportDays } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily report", description: "One day of the agent's work, counted from its ledgers: what it tested, what held, what failed, and what the swarm did." };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const q = (await searchParams).day;
  const today = new Date().toISOString().slice(0, 10);
  const day = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today;
  const r = report(day);
  const days = reportDays();
  const rows: [string, number][] = [
    ["genes read", r.genes], ["lab proposals written", r.proposals], ["receipts printed", r.receipts],
    ["sealed predictions tested", r.tested], ["held in both donor halves", r.held], ["swarm cases opened", r.cases],
    ["sealed studies run", r.studies], ["predictions from visitors and agents", r.visitors],
  ];
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Daily report, UTC</p>
        <h1>{day === today ? "Today, so far" : new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</h1>
        <p className="lede">What the agent did in one day, counted from its ledgers. Today&apos;s report updates as it works.</p>
      </section>
      <article>
        <Sec title="The day in numbers">
          <pre className="ascii">{rows.map(([k, v]) => `${String(v.toLocaleString("en")).padStart(6)}  ${k}`).join("\n")}</pre>
          <h3 className="ex-title">Held in both halves</h3>
          {r.held_rows.length ? (
            <ol className="experiments">
              {r.held_rows.map((h, i) => (
                <li key={i} className="pass">
                  <span className="ex-gene"><Link href={`/gene/${h.gene}`}><i>{h.gene}</i></Link> in {h.grp}</span>
                  <span className="ex-nums">{h.axis}</span>
                  <span className="ex-verdict">held</span>
                </li>
              ))}
            </ol>
          ) : <p className="quiet small">Nothing held this day.</p>}
        </Sec>
        <Sec title="As a post">
          <p className="report-post">{r.post}</p>
          <p><CopyText text={r.post} /></p>
        </Sec>
        <Sec title="Other days">
          {days.length ? (
            <p className="dates">{days.map((d) => <Link key={d.day} href={`/report?day=${d.day}`} aria-current={d.day === day ? "page" : undefined}>{d.day}</Link>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " ", el] : [el]), [])}</p>
          ) : <p className="quiet small">No days on record yet.</p>}
        </Sec>
      </article>
    </main>
  );
}
