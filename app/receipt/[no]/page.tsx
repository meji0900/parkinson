import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptCheck } from "@/components/receipt-check";
import { getReceipt } from "@/lib/agent/receipts";
import { listCases } from "@/lib/atlas/swarm";
import { explorer } from "@/lib/chain/config";
import { one } from "@/lib/server/db";
import { SwarmCases } from "@/components/sections";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ no: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Receipt ${String((await params).no).padStart(4, "0")}` };
}

export default async function ReceiptPage({ params }: Props) {
  const no = Number((await params).no);
  const r = Number.isInteger(no) ? getReceipt(no) : null;
  if (!r) notFound();
  const anchor = one<{ head_no: number; tx: string; at: string }>("select head_no, tx, at from anchors where head_no >= ? order by head_no limit 1", no);
  const sc = listCases(200, r.subject).find((c) => c.receipt === no);
  return (
    <main className="page">
      <header className="phead">
        <p className="quiet" style={{ margin: 0 }}>Receipt {String(no).padStart(4, "0")}</p>
        <h1>{r.kind === "atlas" ? "A sealed prediction that did not hold." : `No case for ${r.subject}.`}</h1>
        <p>
          {r.why}. This receipt&apos;s hash covers every field on it, plus the hash of receipt {no - 1 || "zero"}, so changing any earlier
          receipt would break every one after it.
        </p>
      </header>
      <section className="entry">
        <div className="note"><b>The slip</b>Checked in this browser.</div>
        <div className="body">
          <ReceiptCheck r={r} />
          <p className="small" style={{ marginTop: 16 }}>
            {anchor ? (
              <>Covered by the on-chain checkpoint of receipt {String(anchor.head_no).padStart(4, "0")} ({anchor.at.slice(0, 16).replace("T", " ")} UTC). <a href={explorer("tx", anchor.tx)} target="_blank" rel="noreferrer">See the checkpoint on Solana devnet</a>.</>
            ) : (
              "Not yet covered by an on-chain checkpoint; the agent anchors the chain head every 25 receipts or every hour."
            )}{" "}
            {no > 1 && <Link href={`/receipt/${no - 1}`}>Previous receipt</Link>}
          </p>
        </div>
      </section>
      {sc && (
        <section className="entry"><div className="note"><b>The swarm&apos;s case</b></div><div className="body"><SwarmCases cases={[sc]} /></div></section>
      )}
    </main>
  );
}
