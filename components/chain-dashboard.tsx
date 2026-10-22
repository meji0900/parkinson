"use client";
// The wallet side of the registry: balance, faucet, the holders' queue, and this wallet's predictions.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { BRAND } from "@/lib/brand";
import { explorer, GATE_AMOUNT, GATE_TOKEN, NETWORK, TOKEN_SYMBOL } from "@/lib/chain/config";
import { ResultCard, type Result } from "./predict";
import { ConnectWallet, useProof, walletError } from "./wallet";

type WalletInfo = { wallet: string; balance: number; predictions: Result[]; faucet: { at: string; tx: string }[]; queued: { gene: string; at: string; done: number }[] };

export function ChainDashboard({ mode, faucet }: { mode: string; faucet: boolean }) {
  const { address } = useConnection();
  const proof = useProof();
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [msg, setMsg] = useState<{ text: string; link?: string | null; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [gene, setGene] = useState("");

  const load = useCallback(async () => {
    if (!address) { setInfo(null); return; }
    try { setInfo(await (await fetch(`/api/chain/wallet/${address}`, { cache: "no-store" })).json()); } catch { /* retry on next action */ }
  }, [address]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ text: walletError(e), err: true }); } finally { setBusy(false); }
  };
  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error ?? "request failed");
    return d;
  };

  const claim = () => act(async () => {
    const p = await proof("faucet");
    const d = await post("/api/chain/faucet", p);
    setMsg({ text: "Test tokens sent.", link: explorer("tx", d.tx) });
    await load();
  });
  const queue = () => act(async () => {
    const g = gene.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!g) throw new Error("type a gene symbol first");
    const p = await proof("queue", { gene: g });
    const d = await post("/api/queue", { ...p, gene: g });
    setMsg({ text: `${d.gene} is number ${d.position} in the holders' queue. Watch the console on the home page.` });
    setGene("");
    await load();
  });

  const mainnet = NETWORK === "mainnet";
  if (!address) {
    return (
      <div className="panel">
        <p style={{ marginTop: 0 }}>
          {mainnet
            ? "Connect a wallet to sign predictions and, holding the token, send the agent a gene to read next."
            : "Connect a wallet to claim test tokens, sign predictions and send the agent a gene to read next."}
        </p>
        <ConnectWallet />
      </div>
    );
  }
  const live = mode === "contract";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span><b style={{ fontSize: 28 }}>{info ? info.balance.toLocaleString("en") : "…"}</b> {TOKEN_SYMBOL}</span>
          <ConnectWallet />
        </div>
        {!mainnet && (
          <div className="actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
            <button className="btn" type="button" disabled={busy || !live || !faucet} onClick={claim}>Claim test tokens</button>
            <span className="small quiet">
              {live && faucet ? "Once a day per wallet. You sign a short message; no transaction, no gas." : "The faucet opens once the registry contract is deployed with a test token."}
            </span>
          </div>
        )}
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Put a gene at the front of the queue</h3>
        <p className="small">
          {GATE_TOKEN
            ? `Wallets holding ${GATE_AMOUNT} ${TOKEN_SYMBOL} or more can send the agent a gene to read next, in public, on the live console.`
            : mainnet ? `The queue opens to holders once the ${BRAND.ticker} token is live.` : "The queue opens once the test token is deployed with the registry."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="gene-in" value={gene} onChange={(e) => setGene(e.target.value)} placeholder="e.g. LRRK2" maxLength={16} aria-label="Gene symbol" />
          <button className="btn dab" type="button" disabled={busy || !GATE_TOKEN} onClick={queue}>Sign and queue</button>
        </div>
        {info?.queued.length ? <p className="small quiet" style={{ marginTop: 10 }}>Queued from this wallet: {info.queued.map((q) => `${q.gene}${q.done ? " (read)" : ""}`).join(", ")}.</p> : null}
      </div>
      {msg && <p className={msg.err ? "err" : ""}>{msg.text} {msg.link && <a href={msg.link} target="_blank" rel="noreferrer">See the transaction</a>}</p>}
      <div>
        <h3>Your predictions</h3>
        {info?.predictions.length ? info.predictions.slice(0, 8).map((r) => <ResultCard key={r.registration} r={r} />) : (
          <p className="quiet">None yet. <Link href="/#predict">Make one on the home page</Link> and sign it with this wallet.</p>
        )}
      </div>
    </div>
  );
}
