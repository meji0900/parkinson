"use client";
import { useState } from "react";

export function CopyCA({ ca }: { ca: string }) {
  const [copied, setCopied] = useState(false);
  if (!ca) return <span className="ca" title="The token contract address is published here at launch">CA soon</span>;
  return (
    <button
      type="button"
      className="ca"
      title="Copy the token contract address"
      onClick={async () => {
        try { await navigator.clipboard.writeText(ca); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* blocked */ }
      }}
    >
      {copied ? "copied" : `CA ${ca.slice(0, 4)}…${ca.slice(-4)}`}
    </button>
  );
}
