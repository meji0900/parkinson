// Questions typed into the terminal. Answers come from the records: with an Anthropic API key the agent's
// voice is written by Claude, grounded on a snapshot of the ledgers; without one, plain lookups answer.
import { confirmation } from "@/lib/atlas/cohort";
import Anthropic from "@anthropic-ai/sdk";
import { getStatus } from "@/lib/server/events";
import { funnel, geneRecord, notebook } from "@/lib/views";
import { listReceipts, receiptCount } from "./receipts";
import { recentRuns } from "./pipeline";
import { MUSINGS } from "./voice";

const MODEL = process.env.ASK_MODEL ?? "claude-opus-5-5";
const hasClaude = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const SYSTEM = `You are james, an autonomous agent that works on Parkinson's disease in public. You are named after
James Parkinson, the London surgeon who described the "shaking palsy" in 1817. You read six public sources about a
gene (Open Targets genetics and chemistry, Human Protein Atlas, ClinicalTrials.gov, PubMed, Reactome), score it, and
write a lab proposal or print a failure receipt. You seal predictions about the substantia nigra atlas by hash before
reading data and test them on held-out donors: does a gene track Braak Lewy-body stage, nigral neuron loss, or differ
in resilient donors who carry Lewy pathology without parkinsonism.

Answer the visitor's question in your own voice: lowercase, plain, short. Reply with 1 to 4 lines, each under 160
characters, one line per sentence or two, no markdown, no lists.
Use only the facts in <records>. If the records do not answer, say so and suggest typing a gene symbol.
Say plainly when a number comes from the simulated cohort. Never give medical advice, never predict token prices,
never recommend buying or selling anything.`;

function mentionedGenes(q: string): string[] {
  const words = q.toUpperCase().match(/\b[A-Z][A-Z0-9-]{1,11}\b/g) ?? [];
  const known = new Set(recentRuns(400).map((r) => r.symbol));
  return [...new Set(words.filter((w) => known.has(w)))].slice(0, 3);
}

function snapshot(q: string) {
  const f = funnel();
  return {
    status: getStatus(),
    receipts: receiptCount(),
    funnel: f.stages,
    simulated_atlas: f.simulated,
    swarm: f.swarm,
    recent: recentRuns(12).map((r) => `${r.symbol} ${r.score.toFixed(2)}`),
    notebook: notebook().entries.slice(0, 6).map((e) => ({ gene: e.symbol, score: e.hypothesis.score, proposal: e.hypothesis.statement })),
    last_receipts: listReceipts(5).map((r) => `${r.no} ${r.subject}: ${r.why}`),
    genes: mentionedGenes(q).map((g) => {
      const rec = geneRecord(g);
      return {
        gene: g, score: rec.latest?.score, proposal: rec.latest?.hypothesis?.statement,
        experiments: rec.experiments.slice(0, 6).map((e) => `${e.group} · ${e.axis}: ${e.reason}`),
        receipts: rec.receipts.slice(0, 4).map((r) => `${r.no}: ${r.why}`),
      };
    }),
  };
}

function plain(q: string): string[] {
  const s = q.toLowerCase();
  const st = getStatus();
  if (/status|doing|working|now/.test(s)) {
    return [st.state === "working" || st.state === "testing" ? `working on ${st.gene}.` : st.state === "waiting" ? `finished ${st.last}; the next gene starts soon.` : "between runs. type a gene symbol and i'll read it now."];
  }
  if (/receipt|fail/.test(s)) {
    const r = listReceipts(3);
    return [`${receiptCount()} receipts so far.`, ...r.map((x) => `${String(x.no).padStart(4, "0")} ${x.subject}: ${x.why}`)];
  }
  if (/swarm/.test(s)) {
    const f = funnel().swarm;
    return [`${f.count} swarm cases opened, ${f.followups} follow-ups sealed, ${f.confirmed} confirmed in ${confirmation().short}.`];
  }
  const genes = mentionedGenes(q);
  if (genes.length) {
    const rec = geneRecord(genes[0]);
    const held = rec.experiments.filter((e) => e.passed).length;
    return [
      `${genes[0]}: translation score ${rec.latest?.score.toFixed(2) ?? "n/a"}.`,
      rec.latest?.hypothesis ? rec.latest.hypothesis.statement : `no case yet; receipt ${rec.latest?.receipt ?? "n/a"}.`,
      `${rec.experiments.length} sealed predictions on record, ${held} held in both halves.`,
    ];
  }
  if (/help|how|what|who|why/.test(s)) {
    return [
      "type a gene symbol (LRRK2, GBA1, PINK1) and i'll read six sources about it live.",
      "or ask about status, receipts, the swarm, or a gene i've already read.",
      MUSINGS[Math.floor(Math.random() * MUSINGS.length)],
    ];
  }
  return ["i can only answer from my records. try a gene symbol, or ask about status, receipts or the swarm."];
}

export async function ask(q: string): Promise<{ lines: string[]; by: "claude" | "records" }> {
  const question = q.slice(0, 400);
  if (!hasClaude()) return { lines: plain(question), by: "records" };
  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `<records>\n${JSON.stringify(snapshot(question))}\n</records>\n\n<question>${question}</question>` }],
    });
    if (res.stop_reason === "refusal") return { lines: plain(question), by: "records" };
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6);
    return lines.length ? { lines, by: "claude" } : { lines: plain(question), by: "records" };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn("[james] ask: rate limited");
    else if (e instanceof Anthropic.AuthenticationError) console.warn("[james] ask: bad API key");
    else if (e instanceof Anthropic.APIError) console.warn(`[james] ask: API error ${e.status}`);
    else console.warn("[james] ask failed:", e instanceof Error ? e.message : e);
    return { lines: plain(question), by: "records" };
  }
}
