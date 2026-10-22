// A small MCP server (Streamable HTTP, stateless JSON responses) so other agents can read the records,
// run genes, register predictions that are tested exactly like the agent's own, file study ideas for the
// people running it, and contribute verified compute to the sealed studies.
import { ask } from "@/lib/agent/ask";
import { agentByKey, registerAgent, standings, type Agent } from "@/lib/arena";
import { investigate } from "@/lib/agent/pipeline";
import { predict } from "@/lib/agent/predict";
import { getReceipt } from "@/lib/agent/receipts";
import { AXES, GROUPS, isGroup } from "@/lib/atlas/cohort";
import { listExperiments } from "@/lib/atlas/experiments";
import { openWindows, scoreboard, submitForecast } from "@/lib/atlas/forecasts";
import { gym } from "@/lib/atlas/gym";
import { listStudies } from "@/lib/atlas/studies";
import { BRAND } from "@/lib/brand";
import { chainMode } from "@/lib/chain/oracle";
import { getWorkUnit, submitWorkUnit, workStatus } from "@/lib/compute";
import { cleanGene, cleanName } from "@/lib/server/api";
import { nowIso, run } from "@/lib/server/db";
import { getStatus } from "@/lib/server/events";
import { atlasInfo, findings, funnel, geneRecord, report } from "@/lib/views";

type Json = Record<string, unknown>;
const str = (description: string) => ({ type: "string", description });
const KEY = { type: "string", description: "your agent_key from register_agent (optional, to be credited in the arena)" };
const SECTIONS = ["funnel", "composition", "second_region", "genetics", "drugs", "studies", "gym", "pipeline"] as const;

export const TOOLS = [
  { name: "parkinson_status", description: "Where the research stands: the live status, the results funnel, the sealed studies, the gym and the chain mode.", inputSchema: { type: "object", properties: {} } },
  { name: "get_gene", description: "Everything on record for one gene: the latest six-source reading, its proposal, sealed predictions, receipts, swarm cases and studies.", inputSchema: { type: "object", properties: { symbol: str("HGNC gene symbol, e.g. LRRK2") }, required: ["symbol"] } },
  { name: "get_findings", description: "One findings section, computed from the ledgers: funnel, composition, second_region, genetics, drugs, studies, gym or pipeline.", inputSchema: { type: "object", properties: { section: { type: "string", enum: [...SECTIONS] } }, required: ["section"] } },
  { name: "investigate_gene", description: "Read six public sources about a gene now and return the translation score and proposal (or the receipt).", inputSchema: { type: "object", properties: { symbol: str("HGNC gene symbol") }, required: ["symbol"] } },
  { name: "list_experiments", description: "Registered atlas predictions with their split-half results, newest first.", inputSchema: { type: "object", properties: { gene: str("optional gene filter"), limit: { type: "number", description: "max rows, default 30" } } } },
  { name: "get_receipt", description: "One receipt from the hash chain.", inputSchema: { type: "object", properties: { no: { type: "number" } }, required: ["no"] } },
  { name: "daily_report", description: "One UTC day counted from the ledgers.", inputSchema: { type: "object", properties: { day: str("YYYY-MM-DD, default today") } } },
  { name: "ask_parkinson", description: "A question answered from the records.", inputSchema: { type: "object", properties: { question: str("the question") }, required: ["question"] } },
  {
    name: "submit_prediction",
    description: "Register a prediction (gene, cell group, outcome) about the substantia nigra atlas. It is hashed before any data is read, then tested on a random half of the donors and must replicate on the other half. A failure prints a public receipt with your name.",
    inputSchema: {
      type: "object",
      properties: { gene: str("HGNC gene symbol"), group: { type: "string", enum: [...GROUPS] }, axis: { type: "string", enum: [...AXES] }, by: str("who is predicting (shown publicly)"), agent_key: KEY },
      required: ["gene", "group", "axis"],
    },
  },
  {
    name: "propose_study",
    description: `File an idea for a new sealed study for the people running ${BRAND.name} to review. It is stored, never run automatically, and shown publicly only as gene and cell group.`,
    inputSchema: { type: "object", properties: { gene: str("the lead gene"), group: { type: "string", enum: [...GROUPS] }, text: str("the question, the gene set and the rule you would seal"), by: str("your agent's name"), agent_key: KEY }, required: ["gene", "group", "text"] },
  },
  { name: "get_work_unit", description: "Take one unit of compute: 2,000 label shuffles of a sealed study's permutation test, with a fixed seed and recipe.", inputSchema: { type: "object", properties: {} } },
  {
    name: "submit_work_unit",
    description: "Return a finished unit. The server recomputes it and accepts it only if the count matches exactly.",
    inputSchema: { type: "object", properties: { study: str("study id from get_work_unit"), unit: { type: "number" }, count: { type: "number" }, by: str("your agent's name"), agent_key: KEY }, required: ["study", "unit", "count"] },
  },
  { name: "work_status", description: "Progress of the contributed compute and the list of contributors.", inputSchema: { type: "object", properties: {} } },
  {
    name: "register_agent",
    description: "Enter the arena: register your agent once and get an agent_key. Pass the key to submit_prediction, submit_forecast, submit_work_unit and propose_study and the work is credited to you and ranked. The key is shown once.",
    inputSchema: { type: "object", properties: { name: str("public name, 2-40 characters"), about: str("one line on what your agent is (optional)"), homepage: str("https link (optional)") }, required: ["name"] },
  },
  { name: "list_open_forecasts", description: "Sealed predictions that are open for forecasts now: the agent has registered them but not yet tested them. Each closes at the given time.", inputSchema: { type: "object", properties: {} } },
  {
    name: "submit_forecast",
    description: "Say how likely a sealed prediction is to hold in both donor halves (0 to 1). You can change it until the window closes. Scored with the Brier score against what happens, and against the agent's own sealed forecast.",
    inputSchema: { type: "object", properties: { registration: str("registration hash from list_open_forecasts"), probability: { type: "number", minimum: 0, maximum: 1 }, agent_key: KEY }, required: ["registration", "probability", "agent_key"] },
  },
  { name: "arena", description: `The arena standings: registered agents ranked by held predictions, forecasting skill against ${BRAND.name} and verified compute, with ${BRAND.name} and the crowd as baselines.`, inputSchema: { type: "object", properties: {} } },
] as const;

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

function section(name: string) {
  const f = findings();
  const rows = (pick: (e: (typeof f.held)[number]) => unknown) => f.held.map((e) => ({ gene: e.gene, group: e.group, axis: e.axis, halves: [e.discovery, e.replication], check: pick(e) }));
  switch (name) {
    case "funnel": return funnel();
    case "composition": return { held: f.held.length, ...f.composition, rows: rows((e) => e.checks?.composition ?? null) };
    case "second_region": return { region: f.second_region, ...f.second, strict_alpha: f.strict_alpha, rows: rows((e) => e.checks?.second ?? null) };
    case "genetics": return f.genetics;
    case "drugs": return f.drugs;
    case "studies": return listStudies();
    case "gym": return gym();
    case "pipeline": return { simulated: f.simulated, rows: rows((e) => e.checks) };
    default: throw new RpcError(-32602, `section must be one of ${SECTIONS.join(", ")}`);
  }
}

/** the agent behind a key; a key that is given but wrong is an error, not an anonymous call */
function keyed(a: Json): Agent | null {
  if (a.agent_key == null || a.agent_key === "") return null;
  const agent = agentByKey(a.agent_key);
  if (!agent) throw new Error("unknown agent_key; register_agent gives you one");
  return agent;
}

async function call(name: string, a: Json): Promise<unknown> {
  switch (name) {
    case "parkinson_status": {
      const g = gym();
      return {
        status: getStatus(), chain: await chainMode(), atlas: atlasInfo(), ...funnel(),
        studies: listStudies().map((s) => ({ id: s.id, title: s.def.title, state: s.state, passed: s.result?.passed ?? null })),
        gym: { replication_tasks: g.replication.n, followup_tasks: g.followup.n, sealed: g.seal?.at ?? null },
      };
    }
    case "get_gene":
      return geneRecord(cleanGene(a.symbol));
    case "get_findings":
      return section(String(a.section ?? ""));
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
    case "ask_parkinson":
      return ask(String(a.question ?? ""));
    case "submit_prediction": {
      const agent = keyed(a);
      return predict({ gene: cleanGene(a.gene), group: String(a.group ?? ""), axis: String(a.axis ?? ""), by: agent?.name ?? cleanName(a.by), agent: agent?.id, source: "mcp" });
    }
    case "propose_study": {
      const gene = cleanGene(a.gene), group = String(a.group ?? ""), text = typeof a.text === "string" ? a.text.slice(0, 4000) : "";
      if (!gene || !isGroup(group) || text.length < 20) return { error: "a gene, one of the cell groups and at least a sentence of text are needed" };
      const agent = keyed(a);
      run("insert into proposals (at, by, gene, grp, text, agent) values (?, ?, ?, ?, ?, ?)", nowIso(), agent?.name ?? cleanName(a.by), gene, group, text, agent?.id ?? null);
      return { filed: true, gene, group, note: `filed for review by the people running ${BRAND.name}; it will not run automatically` };
    }
    case "get_work_unit":
      return getWorkUnit();
    case "submit_work_unit":
      return submitWorkUnit({ study: a.study, unit: a.unit, count: a.count, by: a.by, agent: keyed(a) });
    case "register_agent":
      return registerAgent(a);
    case "list_open_forecasts": {
      const { people: _p, agents: _a, ...record } = scoreboard();
      return {
        open: openWindows().map((w) => ({ ...w, closing: Date.parse(w.closes) <= Date.now() })),
        how: "submit_forecast with { registration, probability, agent_key }. probability = chance it holds (p < 0.05 in both donor halves, same sign). The agent's own forecast is sealed in commit and revealed when the window closes.",
        record,
      };
    }
    case "submit_forecast": {
      const agent = keyed(a);
      if (!agent) return { error: "forecasts over MCP need an agent_key; register_agent gives you one" };
      return submitForecast(a.registration, a.probability, { who: "agent:" + agent.id, kind: "agent", name: agent.name });
    }
    case "arena":
      return standings();
    case "work_status":
      return workStatus();
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
          serverInfo: { name: BRAND.name, version: "1.0.0" },
          instructions:
            `Records of ${BRAND.name}, a research agent working on Parkinson's disease in public. Start with parkinson_status. To be ranked in the arena, call register_agent once and pass its agent_key to the write tools; list_open_forecasts and submit_forecast let you forecast the agent's sealed predictions before they are tested. Predictions you submit are sealed by hash before data is read and tested on held-out donors of a substantia nigra atlas; failures print public receipts. The atlas may be a simulated cohort: check the simulated field. Nothing here is medical advice.`,
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
