import type { Metadata } from "next";
import { ChainDashboard } from "@/components/chain-dashboard";
import { ContractProofPanel } from "@/components/contract-proof";
import { Sec } from "@/components/sections";
import { BRAND } from "@/lib/brand";
import { CHAIN, explorer, GATE_AMOUNT, GATE_TOKEN, NETWORK, short, TOKEN_SYMBOL } from "@/lib/chain/config";
import { chainStatus } from "@/lib/chain/oracle";
import { contractProof } from "@/lib/chain/proof";
import { within } from "@/lib/server/timeout";
import { leaderboard } from "@/lib/views";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "On-chain registry", description: `Sealed predictions, oracle results, receipt checkpoints and rewards on ${CHAIN.name}.` };

/** an address or transaction, linked to Blockscout on the chain it belongs to */
const A = ({ id, kind = "address", chain }: { id: string; kind?: "address" | "tx" | "token"; chain?: string | null }) => {
  const href = id.startsWith("0x") ? explorer(kind, id, chain) : null;
  const text = id.length > 20 ? short(id) : id;
  return href ? <a className="mono" href={href} target="_blank" rel="noreferrer">{text}</a> : <span className="mono">{text}</span>;
};

export default async function ChainPage() {
  const [s, proof] = await Promise.all([within(chainStatus(), 6000, null), within(contractProof(), 6000, null)]);
  const board = leaderboard();
  const mode = s?.mode ?? "off";
  const st = s?.state;
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">On-chain registry, {CHAIN.name}</p>
        <h1>Proof that each prediction was sealed before its result existed.</h1>
        <p className="lede">
          The registry contract keeps one entry per wallet prediction: its hash, the wallet that signed it, the block time it was sealed, and the
          split-half result the agent writes back. The agent&apos;s own predictions are sealed as contract events, a gene&apos;s worth in one transaction.
          Robinhood Chain is an Ethereum L2 with ETH for gas; the agent pays it for the predictions you sign.{" "}
          {NETWORK === "mainnet"
            ? <>Rewards stay off until the owner funds them.</>
            : <>A prediction that replicates earns {TOKEN_SYMBOL}, a test token with no value; the {BRAND.ticker} token, when it launches, is a separate thing.</>}
        </p>
        <p className="stat-line">mode: <b>{mode === "contract" ? "contract live" : mode === "memo" ? "memo transactions" : "off on this server"}</b></p>
      </section>
      <article>
        <Sec id="proof" title="Proof of deployment">
          {proof
            ? <ContractProofPanel p={proof} />
            : <p className="quiet">The registry is not deployed on {CHAIN.name} yet; its address, block and verified source appear here once it is.</p>}
        </Sec>
        <Sec title="Your wallet">
          <ChainDashboard mode={mode} faucet={!!st && st.faucetAmount > 0} />
        </Sec>
        <Sec title="The registry">
          {mode !== "contract" && (
            <p className="note" role="note">
              {mode === "memo"
                ? <><b>The registry contract is not deployed on {CHAIN.name} yet.</b> Until it is, every seal, result and receipt checkpoint is written as memo data in a transaction from the agent&apos;s key, which is still a public, timestamped proof. Wallet predictions, rewards and the faucet switch on with the contract.</>
                : <><b>On-chain writes are off on this server.</b> Give it a signer key (SIGNER_PRIVATE_KEY, or the keystore in .keys) to turn on memo mode, and deploy the registry contract for the rest.</>}
            </p>
          )}
          {s ? (
            <dl className="kv">
              <dt>Network</dt><dd>{CHAIN.name}, chain {CHAIN.id}</dd>
              <dt>Registry contract</dt><dd>{s.registry ? <A id={s.registry} /> : "not deployed"}</dd>
              <dt>Agent (oracle)</dt><dd>{s.agent ? <><A id={s.agent} /> {s.agentEth != null ? `${s.agentEth.toFixed(5)} ETH for gas` : ""}</> : "no key configured"}</dd>
              {st && (
                <>
                  <dt>Owner</dt><dd><A id={st.owner} /></dd>
                  <dt>Predictions</dt><dd>{st.predictions} registered, {st.resolved} resolved, {st.replicated} replicated</dd>
                  <dt>Receipt chain head</dt><dd>no. {st.receiptHeadNo}, <span className="mono">{st.receiptHeadHash.slice(0, 16)}…</span></dd>
                  <dt>Rewards</dt>
                  <dd>
                    {st.token ? <><A id={st.token} kind="token" />: {st.rewardAmount ? `${st.rewardAmount.toLocaleString("en")} per replicated prediction` : "rewards off"}, faucet {st.faucetAmount ? `${st.faucetAmount.toLocaleString("en")}` : "off"}, {st.pool.toLocaleString("en")} left in the pool</> : "off: no reward token set"}
                  </dd>
                </>
              )}
              <dt>Queue gate</dt><dd>{GATE_TOKEN ? <>{GATE_AMOUNT} {TOKEN_SYMBOL} (<A id={GATE_TOKEN} kind="token" />)</> : NETWORK === "mainnet" ? "opens when the token launches" : "opens once the test token is deployed"}</dd>
            </dl>
          ) : <p className="quiet small">The {CHAIN.name} RPC did not answer in time. Reload to try again.</p>}
        </Sec>
        <Sec title="Receipt checkpoints">
          <p>The head of the receipt hash chain is anchored every 25 receipts or every hour, so the list can&apos;t be trimmed after the fact.</p>
          {s?.anchors.length ? (
            <table className="tbl">
              <thead><tr><th>head</th><th className="m">hash</th><th>transaction</th></tr></thead>
              <tbody>{s.anchors.map((a) => <tr key={a.tx}><td>no. {a.head_no}</td><td className="m">{a.head_hash.slice(0, 16)}…</td><td><A id={a.tx} kind="tx" chain={a.chain} /></td></tr>)}</tbody>
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
          ) : <p className="quiet small">No wallet predictions yet. Sign one on the home page once the contract is live.</p>}
        </Sec>
      </article>
    </main>
  );
}
