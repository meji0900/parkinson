// The registry's proof of deployment, printed as a slip like the receipts: where the contract lives, when and from which
// wallet it was deployed, and the stamp Sourcify gives its source. Beside it, how anyone can check each line without
// taking this site's word for it.
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { PUBLIC_RPC, short } from "@/lib/chain/config";
import type { ContractProof } from "@/lib/chain/proof";

const when = (s: string) =>
  new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
const day = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const Addr = ({ id, href }: { id: string; href: string | null }) =>
  href ? <a href={href} target="_blank" rel="noreferrer">{short(id)}</a> : <span>{short(id)}</span>;

function stamp(p: ContractProof) {
  const m = p.registry.source?.match;
  if (m === "exact_match") return { text: "VERIFIED · EXACT MATCH", ok: true };
  if (m === "match") return { text: "VERIFIED · SOURCE MATCHES", ok: true };
  if (p.live === false) return { text: "NOT DEPLOYED HERE", ok: false };
  return { text: "DEPLOYED", ok: true };
}

export function ProofSlip({ p }: { p: ContractProof }) {
  const s = stamp(p), src = p.registry.source;
  const owner = p.owner ?? p.deployer;
  return (
    <div className="slip proof-slip">
      <p className="slip-head">
        <b>{BRAND.name.toUpperCase()} REGISTRY</b>
        {p.chain.name}
        <br />chain {p.chain.id}
        {p.at && <><br />deployed {when(p.at)}</>}
      </p>
      <hr />
      <p className="slip-row"><span>registry</span><span><Addr id={p.registry.address} href={p.registry.link} /></span></p>
      {p.token && <p className="slip-row"><span>test token</span><span><Addr id={p.token.address} href={p.token.link} /></span></p>}
      {p.block != null && <p className="slip-row"><span>block</span><span>{p.registry.txLink ? <a href={p.registry.txLink} target="_blank" rel="noreferrer">{p.block.toLocaleString("en")}</a> : p.block.toLocaleString("en")}</span></p>}
      {owner && <p className="slip-row"><span>owner</span><span><Addr id={owner} href={null} /></span></p>}
      {p.oracle && <p className="slip-row"><span>oracle</span><span><Addr id={p.oracle} href={null} /></span></p>}
      {src?.compiler && (
        <>
          <hr />
          <p className="slip-row"><span>compiler</span><span>solc {src.compiler}</span></p>
          <p className="slip-row"><span>settings</span><span>{[src.evm, src.runs != null ? `${src.runs} runs` : null].filter(Boolean).join(", ")}</span></p>
          <p className="slip-row"><span>source</span><span><a href={src.link} target="_blank" rel="noreferrer">Sourcify</a></span></p>
        </>
      )}
      {p.predictions != null && (
        <>
          <hr />
          <p className="slip-row"><span>predictions</span><span>{p.predictions} on-chain</span></p>
          <p className="slip-row"><span>receipt head</span><span>{p.receiptHeadNo ? `no. ${String(p.receiptHeadNo).padStart(4, "0")}` : "not anchored yet"}</span></p>
        </>
      )}
      <div className={`slip-stamp${s.ok ? " ok" : ""}`}>{s.text}</div>
      {p.registry.tx && <p className="slip-hash">deploy tx {p.registry.tx.slice(0, 18)}…</p>}
    </div>
  );
}

/** the slip and the ways to check it, for the registry page */
export function ContractProofPanel({ p }: { p: ContractProof }) {
  const src = p.registry.source;
  return (
    <div className="proof">
      <ProofSlip p={p} />
      <div className="proof-check">
        <p>
          The registry is a public contract. Every line on the slip can be checked without trusting this site: the explorer shows the
          deployment, Sourcify recompiles the published source and compares it byte for byte with the code on-chain, and any RPC answers for
          the contract itself.
        </p>
        <ol className="proof-steps">
          {p.registry.link && <li><a href={p.registry.link} target="_blank" rel="noreferrer">Open the registry on Blockscout</a>: its code, its transactions, and the events it emits for every sealed prediction.</li>}
          {src && <li><a href={src.link} target="_blank" rel="noreferrer">Read the source on Sourcify</a>{src.match === "exact_match" ? ": an exact match, the same compiler and settings producing the very bytes deployed, down to the metadata hash." : "."}</li>}
          {p.registry.txLink && <li><a href={p.registry.txLink} target="_blank" rel="noreferrer">See the deployment transaction</a>{p.block != null ? ` in block ${p.block.toLocaleString("en")}` : ""}{p.deployer ? `, sent by ${short(p.deployer)}` : ""}.</li>}
          <li>
            Ask the chain yourself, with <a href="https://getfoundry.sh" target="_blank" rel="noreferrer">Foundry</a>:
            <pre className="proof-cmd">{`cast call ${p.registry.address} "owner()(address)" --rpc-url ${PUBLIC_RPC}`}</pre>
            {p.owner ? <span className="small quiet proof-answer">It answers {p.owner}.</span> : null}
          </li>
        </ol>
      </div>
    </div>
  );
}

/** one line for the home page, pointing to the full proof */
export function ContractProofLine({ p }: { p: ContractProof }) {
  const m = p.registry.source?.match;
  return (
    <p className="proof-line">
      <span>registry <Addr id={p.registry.address} href={p.registry.link} /></span>
      <span>{p.chain.name}{p.at ? `, deployed ${day(p.at)}` : ""}</span>
      {m && <b>source verified{m === "exact_match" ? ", exact match" : ""}</b>}
      <Link href="/chain#proof">Proof of deployment</Link>
    </p>
  );
}
