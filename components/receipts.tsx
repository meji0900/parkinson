"use client";
// Receipts as till slips. Every hash is recomputed here, in the browser, from the receipt's own fields:
// if the server ever edited one, this page would say so.
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { canon } from "@/lib/canon";

export type Tried = { reader: string; source?: string; score?: string; level?: string; result?: string };
export type Receipt = {
  no: number; at: string; subject: string; kind: string; why: string; tried: Tried[]; sank?: string[]; need?: string[];
  score?: string; group?: string; axis?: string; asked_by?: string | null; source?: string; prev: string; hash: string;
};

const FAC: Record<string, string> = { genetics: "genetics", cell: "cell type", chem: "chemistry", clinic: "trials", lit: "literature", path: "pathways" };
const KIND: Record<string, string> = { weak: "NO CASE", unknown: "UNKNOWN GENE", source: "SOURCE FAILED", lost: "LOST IN MERGE", study: "STUDY MISSED" };
const when = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const pad = (n: number) => String(n).padStart(4, "0");

export async function verify(r: Receipt): Promise<boolean | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const { hash, ...body } = r;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon(body)));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("") === hash;
}

function stampOf(r: Receipt) {
  if (r.kind === "atlas") return r.why.startsWith("did not replicate") ? "DID NOT REPLICATE" : r.why.startsWith("no effect") ? "NO EFFECT" : "NOT TESTED";
  return KIND[r.kind] ?? r.kind.toUpperCase();
}

export function Slip({ r, ok, link = true }: { r: Receipt; ok?: boolean; link?: boolean }) {
  const sank = new Set(r.sank ?? []);
  const test = r.kind === "atlas" || r.kind === "study";
  return (
    <li className="slip">
      <p className="slip-head">
        <b>JAMES RECEIPT</b>
        {link ? <Link href={`/receipt/${r.no}`}>no. {pad(r.no)}</Link> : <span>no. {pad(r.no)}</span>}
        <br />{when(r.at)}
      </p>
      <hr />
      <p className="slip-subject">{r.kind === "study" ? r.subject : <Link href={`/gene/${r.subject}`}>{r.subject}</Link>}</p>
      <p className="slip-why">{test ? <>{r.group}, {r.axis}{r.asked_by ? `, predicted by ${r.asked_by}` : ""}</> : r.why.replace(/^no case: /, "")}</p>
      <hr />
      {r.tried.map((t, i) => (
        <Fragment key={i}>
          {t.score != null ? (
            <p className={`slip-row${sank.has(t.reader) ? " sank" : ""}`}><span>{FAC[t.reader] ?? t.reader}</span><span>{t.score}</span></p>
          ) : (
            <p className="slip-row"><span>{t.reader}</span><span>{t.result}</span></p>
          )}
        </Fragment>
      ))}
      {r.score && (<><hr /><p className="slip-row"><span>translation score</span><span>{r.score}</span></p><p className="slip-row"><span>needed</span><span>0.55</span></p></>)}
      {r.kind === "atlas" && <p className="slip-row"><span>needed</span><span>p &lt; 0.05 twice, same sign</span></p>}
      <hr />
      {test ? <p style={{ margin: 0 }}>{r.why}</p> : <p style={{ margin: 0 }}>needs: {(r.need ?? []).join("; ") || "nothing listed"}</p>}
      {test && r.source && <p className="slip-row" style={{ marginTop: 6 }}><span>data</span><span>{r.source}</span></p>}
      <div className="slip-stamp">{stampOf(r)}</div>
      <p className="slip-hash">
        {r.hash.slice(0, 24)}…<br />follows {r.prev.slice(0, 12)}…{ok === undefined ? "" : ok ? ", recomputed ✓" : ", does not match ✗"}
      </p>
    </li>
  );
}

export function ReceiptStrip({ gene, limit = 12 }: { gene?: string; limit?: number }) {
  const [data, setData] = useState<{ count: number; receipts: Receipt[] } | null>(null);
  const [ok, setOk] = useState<Record<number, boolean | undefined>>({});
  useEffect(() => {
    const load = async () => {
      try {
        const d = (await (await fetch(`/api/receipts?limit=${limit}${gene ? `&gene=${gene}` : ""}`, { cache: "no-store" })).json()) as { count: number; receipts: Receipt[] };
        const checks: Record<number, boolean | undefined> = {};
        for (const r of d.receipts) checks[r.no] = await verify(r);
        setOk(checks);
        setData(d);
      } catch { /* keep what is shown */ }
    };
    load();
    window.addEventListener("james:receipts", load);
    return () => window.removeEventListener("james:receipts", load);
  }, [gene, limit]);
  if (!data) return <p className="chain">loading the receipts</p>;
  if (!data.receipts.length) return <p className="chain">No receipts yet. The first failure will print one here.</p>;
  const rs = data.receipts;
  const good = rs.filter((r) => ok[r.no]).length;
  const byNo = Object.fromEntries(rs.map((r) => [r.no, r]));
  let links = 0, held = 0;
  for (const r of rs) if (byNo[r.no - 1]) { links++; if (byNo[r.no - 1].hash === r.prev) held++; }
  return (
    <>
      <p className="chain">
        <b>{data.count.toLocaleString("en")}</b> receipts in the chain. Of the {rs.length} below, this browser recomputed <b>{good}</b> hashes and they match; <b>{held}</b> of {links} links to the receipt before are intact.
      </p>
      <ol className="slips">{rs.map((r) => <Slip key={r.no} r={r} ok={ok[r.no]} />)}</ol>
    </>
  );
}
