"use client";
import { useState } from "react";

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* blocked */ }
  };
  return { copied, copy };
}

export function CopyCA({ ca }: { ca: string }) {
  const { copied, copy } = useCopy(ca);
  if (!ca) return null;
  return (
    <button type="button" className="ca" title={`Copy contract address ${ca}`} aria-label="Copy contract address" onClick={copy}>
      {/* phones drop the 0x… head; a tap still copies the whole address */}
      <span className="ca-label">CA</span> <span>{copied ? "copied" : <><span className="ca-head">{ca.slice(0, 4)}</span>…{ca.slice(-4)}</>}</span>
    </button>
  );
}

export function CopyCAFull({ ca }: { ca: string }) {
  const { copied, copy } = useCopy(ca);
  return <button type="button" className="ca-full" title="Copy contract address" onClick={copy}>{copied ? "copied" : ca}</button>;
}
