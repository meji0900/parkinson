"use client";
// Receipts as till slips. Every hash is recomputed here, in the browser, from the receipt's own fields:
// if the server ever edited one, this page would say so.
import Link from "next/link";
import { useEffect, useState } from "react";
import { canon } from "@/lib/canon";

export type Tried = { reader: string; source?: string; score?: string; level?: string; result?: string };
export type Receipt = {
  no: number; at: string; subject: string; kind: string; why: string; tried: Tried[]; sank?: string[]; need?: string[];
  score?: string; group?: string; axis?: string; asked_by?: string | null; source?: string; prev: string; hash: string;
};

const FAC: Record<string, string> = { genetics: "genetics", cell: "cell type", chem: "chemistry", clinic: "trials", lit: "literature", path: "pathways" };
const KIND: Record<string, string> = { weak: "NO CASE", unknown: "UNKNOWN GENE", source: "SOURCE FAILED", lost: "LOST IN MERGE" };
const when = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const pad = (n: number) => String(n).padStart(4, "0");

export async function verify(r: Receipt): Promise<boolean | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const { hash, ...body } = r;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon(body)));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("") === hash;
}

export function Slip({ r, ok, link = true }: { r: Receipt; ok?: boolean; link?: boolean }) {
  const sank = new Set(r.sank ?? []);
  const atlas = r.kind === "atlas";
  const stamp = atlas ? (r.why.startsWith("did not replicate") ? "DID NOT REPLICATE" : r.why.startsWith("no effect") ? "NO EFFECT" : "NOT TESTED") : KIND[r.kind] ?? r.kind.toUpperCase();
  return (
    <li className={`slip${link ? "" : " single"}`}>
      <div className="h"><span>ENGRAM RECEIPT</span>{link ? <Link href={`/receipt/${r.no}`}>no. {pad(r.no)}</Link> : <span>no. {pad(r.no)}</span>}</div>
      <div>{when(r.at)}</div>
      <hr />
      <div className="subj"><Link href={`/gene/${r.subject}`} style={{ textDecoration: "none" }}>{r.subject}</Link></div>
      {atlas ? <div>{r.group}, {r.axis}{r.asked_by ? `, predicted by ${r.asked_by}` : ""}</div> : <div>{r.why.replace(/^no case: /, "")}</div>}
      <hr />
      {r.tried.map((t, i) =>
        t.score != null ? (
          <div key={i} className={`row${sank.has(t.reader) ? " sank" : ""}`}><span>{FAC[t.reader] ?? t.reader}</span><span>{t.score}</span></div>
        ) : (
          <div key={i} className="row"><span>{t.reader}</span><span style={{ textAlign: "right" }}>{t.result}</span></div>
        ),
      )}
      {r.score && (<><hr /><div className="row"><span>translation score</span><span>{r.score}</span></div><div className="row"><span>needed</span><span>0.55</span></div></>)}
      {atlas && <div className="row"><span>needed</span><span>p &lt; 0.05 twice, same sign</span></div>}
      <hr />
      {atlas ? <div>{r.why}</div> : <div>needs: {(r.need ?? []).join("; ") || "nothing listed"}</div>}
      {atlas && r.source && <div style={{ color: "#7d6f90" }}>data: {r.source}</div>}
      <div className="stamp">{stamp}</div>
      <div className="hash">
        {r.hash.slice(0, 24)}…<br />follows {r.prev.slice(0, 12)}…{ok === undefined ? "" : ok ? " · checked ✓" : " · does not match ✗"}
      </div>
    </li>
  );
}

export function ReceiptStrip({ gene }: { gene?: string }) {
  const [data, setData] = useState<{ count: number; receipts: Receipt[] } | null>(null);
  const [ok, setOk] = useState<Record<number, boolean | undefined>>({});
  useEffect(() => {
    const load = async () => {
      try {
        const d = (await (await fetch(`/api/receipts?limit=24${gene ? `&gene=${gene}` : ""}`, { cache: "no-store" })).json()) as { count: number; receipts: Receipt[] };
        const checks: Record<number, boolean | undefined> = {};
        for (const r of d.receipts) checks[r.no] = await verify(r);
        setOk(checks);
        setData(d);
      } catch { /* keep what is shown */ }
    };
    load();
    window.addEventListener("engram:receipts", load);
    return () => window.removeEventListener("engram:receipts", load);
  }, [gene]);
  if (!data) return <p className="quiet">Loading receipts…</p>;
  if (!data.receipts.length) return <p className="quiet">No receipts yet. The first failure will print one here.</p>;
  const rs = data.receipts;
  const good = rs.filter((r) => ok[r.no]).length;
  const byNo = Object.fromEntries(rs.map((r) => [r.no, r]));
  let links = 0, held = 0;
  for (const r of rs) if (byNo[r.no - 1]) { links++; if (byNo[r.no - 1].hash === r.prev) held++; }
  return (
    <>
      <p className="chainline">
        <b>{data.count.toLocaleString("en")}</b> receipts in all. Of the {rs.length} below, {good} hashes were recomputed in this browser and match, and {held} of {links} links to the previous receipt are intact.
      </p>
      <ul className="slips">{rs.map((r) => <Slip key={r.no} r={r} ok={ok[r.no]} />)}</ul>
    </>
  );
}
