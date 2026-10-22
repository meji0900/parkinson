"use client";
// The bench: what the agent has on the table right now, beside the headline. The gene and the step come from the
// live feed; the counts are the server's at page load.
import Link from "next/link";
import { useEffect, useState } from "react";
import { describe, useLive } from "./live";

export function Bench({ genes, receipts, tested, held, simulated }: { genes: number; receipts: number; tested: number; held: number; simulated: boolean }) {
  const { status, last } = useLive();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const d = describe(status, last, now);
  const busy = status && (status.state === "working" || status.state === "testing" || status.state === "swarm");
  const gene = status ? (busy ? status.gene : status.last) : undefined;
  return (
    <aside className={`bench${d.on ? "" : " off"}`} aria-live="polite" aria-label="What the agent is doing now">
      <div className="bench-head">
        <span><i aria-hidden />{busy ? "on the bench now" : "last on the bench"}</span>
        <a href="#live">watch</a>
      </div>
      <p className="bench-gene">{gene ? <Link href={`/gene/${encodeURIComponent(gene)}`}>{gene}</Link> : "…"}</p>
      <p className="bench-step">{d.text}</p>
      <dl className="bench-stats">
        <div><dt>genes read</dt><dd>{genes.toLocaleString("en")}</dd></div>
        <div><dt>receipts</dt><dd>{receipts.toLocaleString("en")}</dd></div>
        <div><dt>predictions sealed</dt><dd>{tested.toLocaleString("en")}</dd></div>
        <div><dt>held in both halves</dt><dd>{held.toLocaleString("en")}</dd></div>
      </dl>
      <div className="bench-foot">
        {simulated ? <span className="badge">atlas: simulated cohort</span> : <span />}
        <button type="button" className="reset" onClick={() => window.dispatchEvent(new Event("parkinson:reset"))}>regrow the cells</button>
      </div>
    </aside>
  );
}
