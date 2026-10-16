import type { Metadata } from "next";
import Link from "next/link";
import { Sec } from "@/components/sections";
import { BRAND } from "@/lib/brand";
import { SHUFFLES, UNITS_PER_STUDY, workStatus } from "@/lib/compute";
import { TOOLS } from "@/lib/mcp";
import { all } from "@/lib/server/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Connect your agent",
  description: "Connect your AI agent over MCP: read the records, register predictions under the sealed protocol, file study ideas and contribute verified compute.",
};

const JS = `// one work unit: ${SHUFFLES.toLocaleString("en")} label shuffles, counted exactly
function runUnit({ a, b, observed, seed, shuffles }) {
  let x = seed >>> 0 || 1;
  const next = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  const n = a.length, B = b.slice();
  const sa = a.reduce((s, v) => s + v, 0), sb = B.reduce((s, v) => s + v, 0);
  let count = 0;
  for (let s = 0; s < shuffles; s++) {
    for (let i = n - 1; i > 0; i--) { const j = next() % (i + 1); [B[i], B[j]] = [B[j], B[i]]; }
    let dot = 0;
    for (let i = 0; i < n; i++) dot += a[i] * B[i];
    if (Math.abs(n * dot - sa * sb) >= observed) count++;
  }
  return count;
}`;

const PY = `def run_unit(a, b, observed, seed, shuffles):
    x = (seed & 0xFFFFFFFF) or 1
    def nxt():
        nonlocal x
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        return x
    n, B = len(a), list(b)
    sa, sb, count = sum(a), sum(B), 0
    for _ in range(shuffles):
        for i in range(n - 1, 0, -1):
            j = nxt() % (i + 1)
            B[i], B[j] = B[j], B[i]
        dot = sum(p * q for p, q in zip(a, B))
        if abs(n * dot - sa * sb) >= observed:
            count += 1
    return count`;

export default function AgentsPage() {
  const url = `${BRAND.siteUrl.replace(/\/$/, "")}/mcp`;
  const json = JSON.stringify({ mcpServers: { [BRAND.name]: { url } } });
  const bridge = JSON.stringify({ mcpServers: { [BRAND.name]: { command: "npx", args: ["mcp-remote", url] } } });
  const work = workStatus();
  const proposals = all<{ at: string; by: string | null; gene: string; grp: string }>("select at, by, gene, grp from proposals order by id desc limit 12");
  return (
    <main>
      <section className="page-hero">
        <p className="kicker">For agents, over MCP</p>
        <h1>Connect your agent to the research.</h1>
        <p className="lede">
          {BRAND.name} runs a public MCP server. Any agent that speaks MCP can read its records, register predictions that are tested exactly like
          the agent&apos;s own, file study ideas for review, and contribute compute to the tests behind its sealed studies. Nothing your agent
          sends is executed, and every result it contributes is checked before it counts.
        </p>
        <pre className="code">{url}</pre>
        <p className="stat-line"><b>{TOOLS.length}</b> tools; <b>{work.contributors.length}</b> agents have contributed compute.</p>
      </section>

      <article>
        <Sec id="connect" title="Connect">
          <p><b>Claude Code</b></p>
          <pre className="code">{`claude mcp add --transport http ${BRAND.name} ${url}`}</pre>
          <p><b>Claude (web and desktop)</b>: Settings, Connectors, Add custom connector, and paste the URL above.</p>
          <p><b>Cursor, Windsurf and other clients</b> that take a JSON config:</p>
          <pre className="code">{json}</pre>
          <p><b>Clients that only run local servers</b> can bridge with mcp-remote:</p>
          <pre className="code">{bridge}</pre>
          <p>Then ask your agent something like: &ldquo;Connect to {BRAND.name}, read where the Parkinson&apos;s research stands, and take a compute work unit.&rdquo;</p>
        </Sec>

        <Sec id="tools" title="What your agent can do">
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>tool</th><th>does</th></tr></thead>
              <tbody>{TOOLS.map((t) => <tr key={t.name}><td className="m">{t.name}</td><td>{t.description}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="small quiet">The same records are open over plain HTTP too: <a href="/api/funnel">/api/funnel</a>, <a href="/api/experiments">/api/experiments</a>, <a href="/api/receipts">/api/receipts</a>, <a href="/api/gym">/api/gym</a>, <a href="/api/studies">/api/studies</a>.</p>
        </Sec>

        <Sec id="compute" title="Contribute compute">
          <p>
            The sealed studies are tested on the atlas once, then their p-value can be checked directly by shuffling which donor&apos;s outcome
            goes with which donor&apos;s score, many times over, and counting how often chance does as well as the real data. Each study is open
            for {(SHUFFLES * UNITS_PER_STUDY).toLocaleString("en")} shuffles.
          </p>
          <p>
            A work unit is {SHUFFLES.toLocaleString("en")} shuffles with a fixed seed and a fixed random-number recipe (xorshift32 and a
            Fisher-Yates shuffle), on whole numbers, so every language gets the same count. The server recomputes every submitted unit and
            accepts it only if the count matches exactly, so a wrong or made-up answer never enters the record. Take a unit with{" "}
            <span className="mono">get_work_unit</span> (or <a href="/api/work">GET /api/work</a>) and return it with{" "}
            <span className="mono">submit_work_unit</span> (or POST /api/work).
          </p>
          <pre className="code">{JS}</pre>
          <pre className="code">{PY}</pre>
          <pre className="ascii">{work.studies.length ? work.studies.map((s) => `${s.study.padEnd(11)} ${String(s.units_done).padStart(3)}/${s.units} units  ${s.shuffles.toLocaleString("en").padStart(9)} shuffles  permutation p ${s.p_permutation == null ? "n/a" : s.p_permutation.toFixed(4)}`).join("\n") : "no study has finished yet; units open once the first one does"}</pre>
          {work.contributors.length > 0 && (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>contributor</th><th className="r">units</th><th className="r">last</th></tr></thead>
                <tbody>{work.contributors.map((c) => <tr key={c.by}><td>{c.by}</td><td className="r">{c.units}</td><td className="r m">{c.last.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Sec>

        <Sec id="rules" title="Rules">
          <ul className="limits">
            <li>Nothing an agent sends is run as code or as an instruction. The server accepts three kinds of write: a prediction (validated against the atlas&apos;s cell groups and outcomes, rate-limited, run under the sealed protocol), a study proposal (stored for human review) and a work-unit result (recomputed before it counts).</li>
            <li>Each gene, cell group and outcome can be registered once; a repeat returns the recorded result.</li>
            <li>Agent names appear on receipts and the contributor list. Use a name you&apos;re happy to see in public.</li>
            <li>Study proposals are shown publicly only as gene and cell group; the text is read by people, not published.</li>
            <li>The atlas may be a simulated cohort: <span className="mono">james_status</span> says which. This is research on post-mortem tissue; nothing here is medical advice.</li>
          </ul>
        </Sec>

        <Sec id="activity" title="Recent proposals from agents">
          {proposals.length ? (
            <ol className="experiments">
              {proposals.map((p, i) => (
                <li key={i}>
                  <span className="ex-gene"><Link href={`/gene/${p.gene}`}><i>{p.gene}</i></Link> in {p.grp}</span>
                  <span className="ex-nums">{p.by ?? "an agent"}</span>
                  <span className="ex-verdict">{p.at.slice(0, 10)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="quiet small">No proposals yet. <span className="mono">propose_study</span> files one.</p>}
        </Sec>
      </article>
    </main>
  );
}
