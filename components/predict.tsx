"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { explorer } from "@/lib/chain/config";
import { ConnectWallet } from "./wallet";

type Stat = { effect: number; p: number; n: number; stat: string } | null;
export type Result = {
  gene: string; group: string; axis: string; registration: string; discovery: Stat; replication: Stat; passed: boolean | null;
  reason: string | null; receipt: number | null; repeat: boolean; by?: string | null; wallet?: string | null; at?: string;
  chain_tx: string | null; resolve_tx: string | null; reward_tx: string | null; chain_status: string | null; simulated: boolean;
};

const AXES: [string, string][] = [
  ["braak", "tracks Braak Lewy-body stage"],
  ["nigra", "tracks nigral neuron loss"],
  ["resilience", "differs in resilient donors"],
];
export const fmt = (h: Stat) => (h ? `${h.effect >= 0 ? "+" : ""}${h.effect.toFixed(2)} (p ${h.p < 0.001 ? h.p.toExponential(1) : h.p.toFixed(3)}, n ${h.n})` : "n/a");
export const pad = (n: number) => String(n).padStart(4, "0");
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const txLink = (sig: string | null) => (sig && !sig.startsWith("account:") ? explorer("tx", sig) : null);

export function Predict({ groups, axes, chainMode, donors }: { groups: string[]; axes?: string[]; chainMode: string; donors: number }) {
  const outcomes = AXES.filter(([v]) => !axes || axes.includes(v));
  const { publicKey, signTransaction } = useWallet();
  const [f, setF] = useState({ gene: "", group: "dopamine neurons", axis: "braak", by: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Result[]>([]);
  const [count, setCount] = useState(0);

  const load = () =>
    fetch("/api/predictions", { cache: "no-store" }).then((r) => r.json()).then((d) => { setRows(d.rows ?? []); setCount(d.count ?? 0); }).catch(() => undefined);
  useEffect(() => { load(); const t = setInterval(load, 45000); return () => clearInterval(t); }, []);

  const post = async (url: string, payload: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error ?? "the server did not accept that; try again");
    return d;
  };

  async function anonymous(e: React.FormEvent) {
    e.preventDefault();
    setBusy(`Sealing the prediction, then testing it on half of the ${donors} donors…`); setErr(null); setOut(null);
    try { setOut(await post("/api/predict", f)); load(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(null); }
  }

  async function withWallet() {
    if (!publicKey || !signTransaction) return;
    setErr(null); setOut(null);
    try {
      setBusy("Preparing the registration transaction…");
      const prep = await post("/api/predict/prepare", { ...f, wallet: publicKey.toBase58() });
      if (prep.repeat) { setOut(prep.result); return; }
      setBusy("Approve the transaction in your wallet. The agent pays the fee.");
      const signed = await signTransaction(VersionedTransaction.deserialize(fromB64(prep.tx)));
      setBusy("Registering on Solana devnet, then testing…");
      setOut(await post("/api/predict/submit", { registration: prep.registration, tx: toB64(signed.serialize()) }));
      load();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <form className="predict" onSubmit={anonymous} autoComplete="off">
        <label>gene<input required value={f.gene} onChange={(e) => setF({ ...f, gene: e.target.value })} placeholder="GBA1" maxLength={16} spellCheck={false} /></label>
        <label>cell type<select value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label>outcome<select value={f.axis} onChange={(e) => setF({ ...f, axis: e.target.value })}>{outcomes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="who">your name on the record (optional)<input value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} maxLength={40} placeholder="anonymous" spellCheck={false} /></label>
        <div className="actions">
          <button className="btn" type="submit" disabled={!!busy}>Register and test</button>
          {chainMode === "program" && (publicKey
            ? <button className="btn dab" type="button" disabled={!!busy || !f.gene} onClick={withWallet}>Sign with wallet and test</button>
            : <ConnectWallet label="Sign it on-chain instead" />)}
          {busy && <span className="busy" role="status">{busy}</span>}
        </div>
      </form>
      <p className="small quiet">
        {chainMode === "program"
          ? "Signed predictions get their own account on Solana devnet. If one replicates, the registry mints test tokens to the wallet that made it."
          : chainMode === "memo"
            ? "Each prediction's hash is also written to Solana devnet in a memo before the data is read."
            : "Predictions are sealed in the ledger; on-chain sealing is off on this server."}
      </p>
      <div className="predict-out" aria-live="polite">
        {err && <p className="err">{err}</p>}
        {out && <ResultCard r={out} />}
      </div>
      <h3 className="ex-title">Visitor predictions <span>{count ? `${count.toLocaleString("en")} so far` : "none yet"}</span></h3>
      {rows.length ? (
        <ol className="experiments">
          {rows.slice(0, 12).map((r, i) => (
            <li key={r.registration + i} className={r.passed ? "pass" : ""}>
              <span className="ex-gene"><Link href={`/gene/${r.gene}`}><i>{r.gene}</i></Link> in {r.group}, {r.axis}</span>
              <span className="ex-nums">{r.by || (r.wallet ? r.wallet.slice(0, 4) + "…" : "anonymous")}{r.repeat ? ", already registered" : ""}</span>
              <span className="ex-verdict">{r.passed ? "held" : r.receipt ? <Link href={`/receipt/${r.receipt}`}>receipt {pad(r.receipt)}</Link> : "failed"}</span>
            </li>
          ))}
        </ol>
      ) : <p className="quiet small">The first one could be yours.</p>}
    </>
  );
}

export function ResultCard({ r }: { r: Result }) {
  const seal = txLink(r.chain_tx), res = txLink(r.resolve_tx), reward = txLink(r.reward_tx);
  return (
    <div className="result">
      <pre>{`${r.gene} in ${r.group}, ${r.axis}${r.repeat ? "   (registered earlier; this is the recorded result)" : ""}
registered   ${r.registration.slice(0, 16)}…
discovery    ${fmt(r.discovery)}
held-out     ${fmt(r.replication)}
verdict      ${r.passed ? "held in both halves" : "did not hold"}${r.simulated ? "\ncohort       simulated (tests the method, not biology)" : ""}`}</pre>
      <p>
        {r.reason}.{" "}
        {r.receipt ? <><Link href={`/receipt/${r.receipt}`}>Receipt {pad(r.receipt)}</Link>. </> : null}
        <Link href={`/gene/${r.gene}`}>Everything on {r.gene}</Link>.
        {seal && <> <a href={seal} target="_blank" rel="noreferrer">Seal on-chain</a>.</>}
        {res && <> <a href={res} target="_blank" rel="noreferrer">Result on-chain</a>.</>}
        {reward && <> <a href={reward} target="_blank" rel="noreferrer">Reward minted</a>.</>}
      </p>
    </div>
  );
}
