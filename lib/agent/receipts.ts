// Receipts: every failure is printed, and each receipt carries the hash of the one before it, so the
// list cannot be edited or trimmed without breaking the chain. Browsers recompute every hash.
import { all, nowIso, one, tx, run } from "@/lib/server/db";
import { hashOf } from "@/lib/server/hash";

export type ReceiptKind = "weak" | "unknown" | "source" | "lost" | "atlas";
export type Tried = { reader: string; source?: string; score?: string; level?: string; result?: string };

export type Receipt = {
  no: number;
  at: string;
  subject: string;
  kind: ReceiptKind;
  why: string;
  tried: Tried[];
  sank?: string[];
  need?: string[];
  score?: string;
  elapsed?: string;
  group?: string;
  axis?: string;
  asked_by?: string | null;
  source?: string;
  registration?: string;
  prev: string;
  hash: string;
};

export const GENESIS = "0".repeat(64);

export function addReceipt(r: Omit<Receipt, "no" | "at" | "prev" | "hash">): Receipt {
  return tx(() => {
    const last = one<{ no: number; hash: string }>("select no, hash from receipts order by no desc limit 1");
    const body = { ...r, no: (last?.no ?? 0) + 1, at: nowIso(), prev: last?.hash ?? GENESIS };
    const clean = JSON.parse(JSON.stringify(body)) as Omit<Receipt, "hash">; // drop undefined fields before hashing
    const hash = hashOf(clean);
    run(
      "insert into receipts (no, at, subject, kind, body, hash, prev) values (?, ?, ?, ?, ?, ?, ?)",
      clean.no, clean.at, clean.subject, clean.kind, JSON.stringify(clean), hash, clean.prev,
    );
    return { ...clean, hash };
  });
}

type Row = { body: string; hash: string };
const parse = (r: Row): Receipt => ({ ...(JSON.parse(r.body) as Omit<Receipt, "hash">), hash: r.hash });

export function listReceipts(limit = 24, before?: number, gene?: string): Receipt[] {
  const where: string[] = [], args: (string | number)[] = [];
  if (before) { where.push("no < ?"); args.push(before); }
  if (gene) { where.push("subject = ?"); args.push(gene); }
  const sql = `select body, hash from receipts ${where.length ? "where " + where.join(" and ") : ""} order by no desc limit ?`;
  return all<Row>(sql, ...args, limit).map(parse);
}

export function getReceipt(no: number): Receipt | null {
  const r = one<Row>("select body, hash from receipts where no = ?", no);
  return r ? parse(r) : null;
}

export const receiptCount = () => one<{ n: number }>("select count(*) as n from receipts")?.n ?? 0;
export const receiptHead = () => one<{ no: number; hash: string }>("select no, hash from receipts order by no desc limit 1") ?? null;

/** Server-side check of the whole chain (used by the cron job before it anchors the head on-chain). */
export function verifyChain(): { ok: boolean; count: number; brokenAt?: number } {
  let prev = GENESIS, count = 0;
  for (const r of all<Row>("select body, hash from receipts order by no")) {
    const rec = parse(r);
    const { hash, ...body } = rec;
    if (rec.prev !== prev || hashOf(body) !== hash) return { ok: false, count, brokenAt: rec.no };
    prev = hash;
    count++;
  }
  return { ok: true, count };
}
