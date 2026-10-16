import type { Metadata } from "next";
import Link from "next/link";
import { caseStudies } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Case studies",
  description: "What the agent's experiments found, and what they don't show: cases written from the public ledgers.",
};

export default function CaseStudies() {
  const { at, simulated, cases } = caseStudies();
  const stamp = new Date(at).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <main>
      <section className="hero" style={{ paddingBottom: 24 }}>
        <p className="kicker">Case studies, data as of {stamp} UTC</p>
        <h1>What the agent&apos;s experiments found, and what they don&apos;t show.</h1>
        <p className="lede">
          Each case says what the agent predicted, what happened on donors it hadn&apos;t seen, what happened in a second region, what the swarm
          made of it, and how much weight it can bear. The cases are written from the public ledgers when this page loads, so they change as the
          agent works.
        </p>
        {simulated && (
          <p className="note" role="note">
            <b>Simulated cohort.</b> Until real nigral data is installed, these cases describe the method at work on generated donors. They show how
            a result is checked, not what is true about Parkinson&apos;s.
          </p>
        )}
      </section>

      <article className="cases">
        {cases.length ? cases.map((c) => (
          <section className="sec cs" id={c.id} key={c.id}>
            <p className="num">{c.kicker}</p>
            <h2>{c.title}</h2>
            <pre className="ascii">{c.ascii}</pre>
            {c.parts.map((p) => <p key={p.label}><b>{p.label}.</b> {p.text}</p>)}
            <p className="cs-limit">{c.limit}</p>
          </section>
        )) : (
          <section className="sec">
            <p className="quiet">No cases yet. The first ones are written once the agent has sealed and tested its first predictions; <Link href="/#live">watch it work</Link>.</p>
          </section>
        )}

        {cases.length > 0 && (
          <section className="sec">
            <p className="num">what it adds up to</p>
            <h2>Where this leaves the work</h2>
            <p>
              The goal stays the same: a short list of experiments a lab can run, each with the result that would kill it, and an open record of
              everything that didn&apos;t make the list. The next steps follow from the cases: test within dopamine-neuron subtypes rather than the
              whole population, adjust the registered test for age, sex and post-mortem interval, and find independent donors, not just
              independent tissue.
            </p>
            <p className="cs-limit">all data public: <Link href="/findings">/findings</Link>, <a href="/api/experiments">/api/experiments</a>, <Link href="/#receipts">the receipts</Link>, <Link href="/paper">the paper</Link></p>
          </section>
        )}
      </article>
    </main>
  );
}
