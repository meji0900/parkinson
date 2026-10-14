"use client";
// Solana wallets through the Wallet Standard (Phantom, Solflare, Backpack and the rest announce
// themselves), with our own small picker instead of the adapter's stock modal.
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import bs58 from "bs58";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PUBLIC_RPC, proofMessage } from "@/lib/chain/config";

export function Wallets({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={PUBLIC_RPC}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function ConnectWallet({ label = "Connect wallet" }: { label?: string }) {
  const { wallets, publicKey, connecting, select, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (publicKey) {
    return (
      <span className="wallet-on">
        <span className="dot" aria-hidden /> <span className="mono">{short(publicKey.toBase58())}</span>
        <button type="button" className="btn line sm" onClick={() => disconnect()}>Disconnect</button>
      </span>
    );
  }
  const ready = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  return (
    <div className="picker" ref={box}>
      <button type="button" className="btn sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={connecting}>
        {connecting ? "Connecting…" : label}
      </button>
      {open && (
        <div className="picker-list" role="menu">
          {ready.length ? (
            ready.map((w) => (
              <button key={w.adapter.name} type="button" role="menuitem" onClick={() => { select(w.adapter.name); setOpen(false); }}>
                {w.adapter.icon && <img src={w.adapter.icon} alt="" width={20} height={20} />} {w.adapter.name}
              </button>
            ))
          ) : (
            <p className="small" style={{ margin: 8 }}>
              No Solana wallet found in this browser. Install <a href="https://phantom.com" target="_blank" rel="noreferrer">Phantom</a>,{" "}
              <a href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a> or{" "}
              <a href="https://backpack.app" target="_blank" rel="noreferrer">Backpack</a>, switch it to devnet, then reload.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** signs the short proof message the server checks for the faucet and the queue */
export function useProof() {
  const { publicKey, signMessage } = useWallet();
  return async (action: string, extra: Record<string, string> = {}) => {
    if (!publicKey || !signMessage) throw new Error("this wallet cannot sign messages");
    const wallet = publicKey.toBase58();
    const sig = await signMessage(new TextEncoder().encode(proofMessage(action, wallet, extra)));
    return { wallet, signature: bs58.encode(sig) };
  };
}
