// A small MCP server (Streamable HTTP, stateless JSON responses) so other agents can read the records,
// run genes and register predictions that are tested exactly like the agent's own.
import { ask } from "@/lib/agent/ask";
import { investigate } from "@/lib/agent/pipeline";
import { predict } from "@/lib/agent/predict";
import { getReceipt } from "@/lib/agent/receipts";
import { AXES, GROUPS } from "@/lib/atlas/cohort";
import { listExperiments } from "@/lib/atlas/experiments";
import { chainMode } from "@/lib/chain/oracle";
import { cleanGene, cleanName } from "@/lib/server/api";
import { getStatus } from "@/lib/server/events";
import { funnel, geneRecord, report } from "@/lib/views";

type Json = Record<string, unknown>;
const str = (description: string) => ({ type: "string", description });

export const TOOLS = [
  { name: "engram_status", description: "Where the research stands: the live status, the results funnel, receipts and the swarm.", inputSchema: { type: "object", properties: {} } },
  { name: "get_gene", description: "Everything on record for one gene: the latest six-source reading, its proposal, sealed predictions, receipts and swarm cases.", inputSchema: { type: "object", properties: { symbol: str("HGNC gene symbol, e.g. TREM2") }, required: ["symbol"] } },
  { name: "investigate_gene", description: "Read six public sources about a gene now and return the translation score and proposal (or the receipt).", inputSchema: { type: "object", properties: { symbol: str("HGNC gene symbol") }, required: ["symbol"] } },
  { name: "list_experiments", description: "Registered atlas predictions with their split-half results, newest first.", inputSchema: { type: "object", properties: { gene: str("optional gene filter"), limit: { type: "number", description: "max rows, default 30" } } } },
  { name: "get_receipt", description: "One receipt from the hash chain.", inputSchema: { type: "object", properties: { no: { type: "number" } }, required: ["no"] } },
  { name: "daily_report", description: "One UTC day counted from the ledgers.", inputSchema: { type: "object", properties: { day: str("YYYY-MM-DD, default today") } } },
  { name: "ask_engram", description: "A question answered from the records.", inputSchema: { type: "object", properties: { question: str("the question") }, required: ["question"] } },
  {
    name: "submit_prediction",
    description: "Register a prediction (gene, cell group, outcome). It is hashed before any data is read, then tested on a random half of the donors and must replicate on the other half.",
    inputSchema: {
      type: "object",
      properties: { gene: str("HGNC gene symbol"), group: { type: "string", enum: [...GROUPS] }, axis: { type: "string", enum: [...AXES] }, by: str("who is predicting (shown publicly)") },
      required: ["gene", "group", "axis"],
    },
  },
] as const;

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

async function call(name: string, a: Json): Promise<unknown> {
  switch (name) {
    case "engram_status":
      return { status: getStatus(), chain: await chainMode(), ...funnel() };
    case "get_gene":
      return geneRecord(cleanGene(a.symbol));
    case "investigate_gene": {
      const rec = await investigate(cleanGene(a.symbol), { source: "mcp", emit: () => undefined, atlas: false });
      if (!rec) return { error: "unknown gene or source failure; see the latest receipt" };
      return {
        symbol: rec.symbol, score: rec.score, passed: rec.passed, proposal: rec.hypothesis ?? null, receipt: rec.receipt ?? null,
        findings: Object.fromEntries(Object.entries(rec.findings).map(([k, f]) => [k, { score: f.score, summary: f.summary }])),
      };
    }
    case "list_experiments":
      return listExperiments({ gene: cleanGene(a.gene) || undefined, limit: Math.min(Number(a.limit) || 30, 200) });
    case "get_receipt":
      return getReceipt(Number(a.no)) ?? { error: "no such receipt" };
    case "daily_report":
      return report(typeof a.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.day) ? a.day : new Date().toISOString().slice(0, 10));
    case "ask_engram":
      return ask(String(a.question ?? ""));
    case "submit_prediction":
      return predict({ gene: cleanGene(a.gene), group: String(a.group ?? ""), axis: String(a.axis ?? ""), by: cleanName(a.by), source: "mcp" });
    default:
      throw new RpcError(-32602, `unknown tool ${name}`);
  }
}

export async function handle(msg: Json): Promise<Json | null> {
  const id = msg.id as string | number | undefined;
  const method = msg.method as string;
  if (id === undefined) return null; // notifications get no reply
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  try {
    switch (method) {
      case "initialize": {
        const asked = (msg.params as Json | undefined)?.protocolVersion;
        return reply({
          protocolVersion: typeof asked === "string" ? asked : "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "engram", version: "1.0.0" },
          instructions:
            "Records of an Alzheimer's research agent. Start with engram_status. Predictions you submit are sealed by hash before data is read; failures print public receipts. The atlas may be a simulated cohort: check the simulated field.",
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call": {
        const p = (msg.params ?? {}) as { name?: string; arguments?: Json };
        try {
          const out = await call(String(p.name), p.arguments ?? {});
          return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 1) }] });
        } catch (e) {
          if (e instanceof RpcError) throw e;
          return reply({ content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true });
        }
      }
      default:
        throw new RpcError(-32601, `method not found: ${method}`);
    }
  } catch (e) {
    const err = e instanceof RpcError ? e : new RpcError(-32603, e instanceof Error ? e.message : "internal error");
    return { jsonrpc: "2.0", id, error: { code: err.code, message: err.message } };
  }
}
