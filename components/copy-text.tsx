"use client";
import { useState } from "react";

export function CopyText({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      style={{ marginLeft: 0 }}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* blocked */ } }}
    >
      {done ? "copied" : label}
    </button>
  );
}
