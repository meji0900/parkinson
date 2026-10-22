"use client";
// EVM wallets through wagmi: every browser wallet that announces itself (EIP-6963: MetaMask, Rabby, Coinbase Wallet,
// the Robinhood Wallet's own browser and the rest) shows up in our own small picker instead of a stock modal.
// NEXT_PUBLIC_E2E=1 on a local node swaps in a mock wallet that anvil signs for, so the flows can be clicked through.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Address, TypedDataDefinition } from "viem";
import {
  createConfig, http, injected, mock, useConnect, useConnection, useDisconnect, useSignMessage, useSignTypedData,
  useSwitchChain, WagmiProvider, type Connector,
} from "wagmi";
import { CHAIN, NETWORK, proofMessage, PUBLIC_RPC, short } from "@/lib/chain/config";

// anvil's second dev account: a visitor distinct from the agent, so the reward path runs in local tests
const E2E = NETWORK === "local" && process.env.NEXT_PUBLIC_E2E === "1";
const config = createConfig({
  chains: [CHAIN],
  connectors: E2E ? [mock({ accounts: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"], features: { reconnect: true } })] : [injected()],
  transports: { [CHAIN.id]: http(PUBLIC_RPC) },
  multiInjectedProviderDiscovery: !E2E,
  ssr: true,
});

export function Wallets({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/** the message a wallet error is worth showing (viem's errors carry a short one) */
export const walletError = (e: unknown) =>
  ((e as { shortMessage?: string })?.shortMessage ?? (e instanceof Error ? e.message : String(e))).replace(/\.$/, "");

/** wallets that announced themselves; the generic "Injected" one only when a lone window.ethereum is all there is */
function useWallets(connectors: readonly Connector[]) {
  const [legacy, setLegacy] = useState(false);
  useEffect(() => setLegacy(typeof window !== "undefined" && !!(window as { ethereum?: unknown }).ethereum), []);
  const announced = connectors.filter((c) => c.id !== "injected");
  if (announced.length || E2E) return E2E ? connectors : announced;
  return legacy ? connectors.filter((c) => c.id === "injected") : [];
}

export function ConnectWallet({ label = "Connect wallet" }: { label?: string }) {
  const { address, chainId } = useConnection();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wallets = useWallets(connectors);
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

  if (address) {
    return (
      <span className="wallet-on">
        <span className="dot" aria-hidden /> <span className="mono">{short(address)}</span>
        {chainId !== CHAIN.id && (
          <button type="button" className="btn line sm" disabled={switching} onClick={() => switchChain({ chainId: CHAIN.id })}>Switch to {CHAIN.name}</button>
        )}
        <button type="button" className="btn line sm" onClick={() => disconnect()}>Disconnect</button>
      </span>
    );
  }
  return (
    <div className="picker" ref={box}>
      <button type="button" className="btn sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={isPending}>
        {isPending ? "Connecting…" : label}
      </button>
      {open && (
        <div className="picker-list" role="menu">
          {wallets.length ? (
            wallets.map((w) => (
              <button key={w.uid} type="button" role="menuitem" onClick={() => { connect({ connector: w }); setOpen(false); }}>
                {w.icon && <img src={w.icon} alt="" width={20} height={20} />} {w.id === "injected" ? "Browser wallet" : w.name}
              </button>
            ))
          ) : (
            <p className="small" style={{ margin: 8 }}>
              No wallet found in this browser. Install <a href="https://metamask.io" target="_blank" rel="noreferrer">MetaMask</a>,{" "}
              <a href="https://rabby.io" target="_blank" rel="noreferrer">Rabby</a> or{" "}
              <a href="https://www.coinbase.com/wallet" target="_blank" rel="noreferrer">Coinbase Wallet</a>, or open this page in the
              Robinhood Wallet app&apos;s browser, then reload. The wallet adds {CHAIN.name} when it is first needed.
            </p>
          )}
        </div>
      )}
      {error && !open && <p className="err small" style={{ margin: "6px 0 0" }}>{walletError(error)}</p>}
    </div>
  );
}

/** signs the short proof message the server checks for the faucet and the queue (no transaction, no gas) */
export function useProof() {
  const { address } = useConnection();
  const { signMessageAsync } = useSignMessage();
  return async (action: string, extra: Record<string, string> = {}) => {
    if (!address) throw new Error("connect a wallet first");
    const signature = await signMessageAsync({ message: proofMessage(action, address, extra) });
    return { wallet: address as Address, signature };
  };
}

/** signs typed data on the registry's chain, asking the wallet to switch (and add the chain) first if it is elsewhere */
export function useSignTyped() {
  const { chainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  return async (typed: TypedDataDefinition) => {
    if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id });
    return signTypedDataAsync(typed as Parameters<typeof signTypedDataAsync>[0]);
  };
}
