import type { Metadata } from "next";
import { ChainDashboard } from "@/components/chain-dashboard";
import { Sec } from "@/components/sections";
import { BRAND } from "@/lib/brand";
import { CLUSTER, explorer, GATE_AMOUNT, TOKEN_SYMBOL } from "@/lib/chain/config";
import { chainStatus } from "@/lib/chain/oracle";
import { within } from "@/lib/server/timeout";
import { leaderboard } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "On-chain registry", description: "Sealed predictions, oracle results, receipt checkpoints and test-token rewards on Solana devnet." };

const A = ({ id, kind = "address" }: { id: string; kind?: "address" | "tx" }) => (
  <a className="mono" href={explorer(kind, id)} target="_blank" rel="noreferrer">{id.slice(0, 6)}…{id.slice(-6)}</a>
);

export default async function ChainPage() {
  const s = await within(chainStatus(), 6000, null);
  const board = leaderboard();
  const mode = s?.mode ?? "off";
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">On-chain registry, Solana {CLUSTER}</p>
        <h1>Proof that each prediction was sealed before its result existed.</h1>
        <p className="lede">
          The registry program keeps one account per wallet prediction: its hash, the wallet that made it, the block time it was sealed, and the
          split-half result the agent writes back. A prediction that replicates mints {TOKEN_SYMBOL} to its wallet. Test tokens have no value;
          the {BRAND.ticker} token, when it launches, is a separate thing.
        </p>
        <p className="stat-line">mode: <b>{mode === "program" ? "program live" : mode === "memo" ? "memo transactions" : "off on this server"}</b></p>
      </section>
      <article>
        <Sec title="Your wallet">
          <ChainDashboard mode={mode} />
        </Sec>
        <Sec title="The registry">
          {mode !== "program" && (
            <p className="note" role="note">
              {mode === "memo"
                ? <><b>The registry program is not deployed on {CLUSTER} yet.</b> Until it is, every seal, result and receipt checkpoint is written as a memo transaction from the agent&apos;s key, which is still a public, timestamped proof. Wallet predictions, rewards and the faucet switch on with the program.</>
                : <><b>On-chain writes are off on this server.</b> Give it an agent key (AGENT_KEYPAIR_PATH or AGENT_SECRET_KEY) to turn on memo mode, and deploy the registry program for the rest.</>}
            </p>
          )}
          {s ? (
            <dl className="kv">
              <dt>Program</dt><dd><A id={s.program} /></dd>
              <dt>Registry account</dt><dd><A id={s.registry} /></dd>
              <dt>{TOKEN_SYMBOL} mint</dt><dd><A id={s.mint} /> ({s.decimals} decimals, {s.supply.toLocaleString("en")} minted)</dd>
              <dt>Agent (oracle)</dt><dd>{s.agent ? <><A id={s.agent} /> {s.agentSol != null ? `${s.agentSol.toFixed(3)} SOL for fees` : ""}</> : "no key configured"}</dd>
              {s.state && (
                <>
                  <dt>Predictions</dt><dd>{s.state.predictions} registered, {s.state.resolved} resolved, {s.state.replicated} replicated</dd>
                  <dt>Receipt chain head</dt><dd>no. {s.state.receiptHeadNo}, <span className="mono">{s.state.receiptHeadHash.slice(0, 16)}…</span></dd>
                  <dt>Rewards</dt><dd>{s.state.rewardAmount / 1e6} {TOKEN_SYMBOL} per replicated prediction; faucet {s.state.faucetAmount / 1e6}</dd>
                </>
              )}
              <dt>Queue gate</dt><dd>{GATE_AMOUNT} {TOKEN_SYMBOL}</dd>
            </dl>
          ) : <p className="quiet small">The Solana RPC did not answer in time. Reload to try again.</p>}
        </Sec>
        <Sec title="Receipt checkpoints">
          <p>The head of the receipt hash chain is anchored every 25 receipts or every hour, so the list can&apos;t be trimmed after the fact.</p>
          {s?.anchors.length ? (
            <table className="tbl">
              <thead><tr><th>head</th><th className="m">hash</th><th>transaction</th></tr></thead>
              <tbody>{s.anchors.map((a) => <tr key={a.tx}><td>no. {a.head_no}</td><td className="m">{a.head_hash.slice(0, 16)}…</td><td><A id={a.tx} kind="tx" /></td></tr>)}</tbody>
            </table>
          ) : <p className="quiet small">No checkpoint yet.</p>}
        </Sec>
        <Sec title="Leaderboard">
          <p>Wallets ranked by predictions that held.</p>
          {board.length ? (
            <table className="tbl">
              <thead><tr><th>wallet</th><th className="r">tested</th><th className="r">held</th><th className="r">rewarded</th></tr></thead>
              <tbody>{board.map((b) => <tr key={b.wallet}><td><A id={b.wallet} /></td><td className="r">{b.n}</td><td className="r">{b.held}</td><td className="r">{b.rewarded}</td></tr>)}</tbody>
            </table>
          ) : <p className="quiet small">No wallet predictions yet. Sign one on the home page once the program is live.</p>}
        </Sec>
      </article>
    </main>
  );
}
