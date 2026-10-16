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
    <figure className="hyp" aria-label={`Proposal for ${gene}`}>
      <figcaption>proposal for <i>{gene}</i>, translation score {hyp.score.toFixed(2)}</figcaption>
      <p className="hyp-statement">{hyp.statement}</p>
      <dl className="hyp-grid">
        <div><dt>Cell type</dt><dd>{hyp.cell}</dd></div>
        <div><dt>Direction</dt><dd>Both arms: {hyp.direction_why}.</dd></div>
        <div><dt>Molecular readout</dt><dd>{hyp.molecular}</dd></div>
        <div><dt>Functional readout</dt><dd>{hyp.functional}</dd></div>
        <div className="span"><dt>Rule-out</dt><dd>{hyp.falsifier}</dd></div>
        <div className="span">
          <dt>Lab request</dt>
          <dd>{hyp.lab_ask} <button className="copy" type="button" onClick={copy}>{copied ? "copied" : "copy"}</button></dd>
        </div>
      </dl>
    </figure>
  );
}
