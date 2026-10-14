"use client";
import { useState } from "react";

export type Hyp = {
  score: number; statement: string; direction_why: string; cell: string; theme: string;
  molecular: string; functional: string; falsifier: string; lab_ask: string; dissent?: string[];
};

export function Proposal({ hyp, gene }: { hyp: Hyp; gene: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hyp.lab_ask);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the text is on screen */
    }
  };
  return (
    <article className="proposal" aria-label={`Proposal for ${gene}`}>
      <p className="quiet small" style={{ margin: "0 0 6px" }}>
        Proposal for <i className="g">{gene}</i>, translation score {hyp.score.toFixed(2)}
      </p>
      <h3>{hyp.statement}</h3>
      <dl>
        <dt>Cell type</dt><dd>{hyp.cell}</dd>
        <dt>Direction</dt><dd>Both arms: {hyp.direction_why}.</dd>
        <dt>Molecular readout</dt><dd>{hyp.molecular}</dd>
        <dt>Functional readout</dt><dd>{hyp.functional}</dd>
        <dt>What would rule it out</dt><dd>{hyp.falsifier}</dd>
      </dl>
      <div className="lab-ask">
        <span style={{ flex: 1 }}><b>Lab request.</b> {hyp.lab_ask}</span>
        <button type="button" className="btn line sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </article>
  );
}
