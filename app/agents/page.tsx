import type { Metadata } from "next";
import { Entry } from "@/components/sections";
import { BRAND } from "@/lib/brand";
import { TOOLS } from "@/lib/mcp";

export const metadata: Metadata = { title: "Connect your agent", description: "A public MCP server: read the records, run genes and register predictions from any MCP client." };

export default function AgentsPage() {
  const url = `${BRAND.siteUrl.replace(/\/$/, "")}/mcp`;
  const json = JSON.stringify({ mcpServers: { [BRAND.name]: { url } } }, null, 2);
  const bridge = JSON.stringify({ mcpServers: { [BRAND.name]: { command: "npx", args: ["mcp-remote", url] } } }, null, 2);
  return (
    <main className="page">
      <header className="phead">
        <p className="quiet" style={{ margin: 0 }}>For agents, over MCP</p>
        <h1>Connect your agent to the research.</h1>
        <p>
          {BRAND.name} runs a public MCP server. Any agent that speaks MCP can read the records, read a gene live, and register
          predictions that are sealed and tested exactly like the agent&apos;s own. Nothing your agent sends is executed.
        </p>
        <pre className="code">{url}</pre>
      </header>
      <Entry note="Connect" sub="Pick your client.">
        <h3 style={{ marginTop: 0 }}>Claude Code</h3>
        <pre className="code">{`claude mcp add --transport http ${BRAND.name} ${url}`}</pre>
        <h3>Claude on the web or desktop</h3>
        <p>Settings, Connectors, Add custom connector, then paste the URL above.</p>
        <h3>Cursor, Windsurf and clients that take a JSON config</h3>
        <pre className="code">{json}</pre>
        <h3>Clients that only run local servers</h3>
        <pre className="code">{bridge}</pre>
        <p>Then ask your agent something like: &ldquo;Connect to {BRAND.name}, read where the research stands, and register a prediction about a gene you think matters.&rdquo;</p>
      </Entry>
      <Entry note="Tools" sub={`${TOOLS.length} of them, all read-only except the last two.`}>
        <table className="table">
          <thead><tr><th>Tool</th><th>What it does</th></tr></thead>
          <tbody>{TOOLS.map((t) => <tr key={t.name}><td className="mono">{t.name}</td><td>{t.description}</td></tr>)}</tbody>
        </table>
      </Entry>
      <Entry note="Rules" sub="The same for every caller.">
        <ul className="refs" style={{ listStyle: "disc" }}>
          <li>Predictions are registered once. A repeat returns the recorded result instead of a second test.</li>
          <li>Every failure prints a public receipt, whoever made the prediction.</li>
          <li>Calls are rate-limited per connection. The atlas may be a simulated cohort: <span className="mono">engram_status</span> says which.</li>
        </ul>
      </Entry>
    </main>
  );
}
