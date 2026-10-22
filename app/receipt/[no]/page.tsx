import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptCheck } from "@/components/receipt-check";
import { Sec, SwarmCases } from "@/components/sections";
import { getReceipt } from "@/lib/agent/receipts";
import { listCases } from "@/lib/atlas/swarm";
import { explorer } from "@/lib/chain/config";
import { one } from "@/lib/server/db";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ no: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Receipt ${String((await params).no).padStart(4, "0")}` };
}

const HEAD: Record<string, string> = {
  atlas: "A sealed prediction that did not hold.",
  study: "A sealed study that missed its rule.",
  unknown: "Not a gene the agent could find.",
  source: "A source failed mid-run.",
  lost: "A finding was lost in the merge.",
};

export default async function ReceiptPage({ params }: Props) {
  const no = Number((await params).no);
  const r = Number.isInteger(no) ? getReceipt(no) : null;
  if (!r) notFound();
  const anchor = one<{ head_no: number; tx: string; at: string; chain: string | null }>("select head_no, tx, at, chain from anchors where head_no >= ? order by head_no limit 1", no);
  const proof = anchor ? explorer("tx", anchor.tx, anchor.chain) : null;
  const sc = listCases(200, r.subject).find((c) => c.receipt === no);
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Receipt {String(no).padStart(4, "0")}</p>
        <h1>{HEAD[r.kind] ?? `No case for ${r.subject}.`}</h1>
        <p className="lede">
          {r.why}. This receipt&apos;s hash covers every field on it, plus the hash of receipt {no - 1 || "zero"}, so changing any earlier receipt
          would break every one after it. Your browser recomputes it below.
        </p>
      </section>
      <article>
        <Sec title="The slip">
          <ReceiptCheck r={r} />
          <p className="small" style={{ marginTop: 18 }}>
            {anchor ? (
              <>Covered by the on-chain checkpoint of receipt {String(anchor.head_no).padStart(4, "0")} ({anchor.at.slice(0, 16).replace("T", " ")} UTC).{proof && <> <a href={proof} target="_blank" rel="noreferrer">See the checkpoint on Robinhood Chain</a>.</>}</>
            ) : "Not yet covered by an on-chain checkpoint; the agent anchors the chain head every 25 receipts or every hour when the chain is on."}{" "}
            {no > 1 && <Link href={`/receipt/${no - 1}`}>Previous receipt</Link>}{" "}
            {getReceipt(no + 1) && <Link href={`/receipt/${no + 1}`}>Next</Link>}
          </p>
        </Sec>
        {sc && <Sec title="The swarm's case"><SwarmCases cases={[sc]} /></Sec>}
      </article>
    </main>
  );
}
