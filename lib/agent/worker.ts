// The agent's own loop. Every AGENT_INTERVAL_SECONDS it takes the next gene (token holders' requests
// first, then the Open Targets Parkinson's pool, best-scored first) and works it in public. Sealed studies
// queued in lib/atlas/studies.ts run between genes. At 02:30 UTC it runs the night's top 80 and keeps the
// best 12 in the notebook.
import { anchorReceipts, chainMode, resolveOnChain, sealOnChain, syncOnchainPredictions } from "@/lib/chain/oracle";
import { all, kvGet, kvSet, nowIso, one, run } from "@/lib/server/db";
import { agentInterval, getStatus, pushEvent, setStatus } from "@/lib/server/events";
import { getJSON } from "@/lib/server/http";
import { appendRunEvents, investigate, narrateResult, type Hooks } from "./pipeline";
import { MUSINGS } from "./voice";
import { PD_ID } from "./readers";
import { nextStudy, runStudy } from "@/lib/atlas/studies";
import { sealGymIfReady } from "@/lib/atlas/gym";
import { AXIS_SHORT } from "@/lib/atlas/cohort";
import type { Experiment } from "@/lib/atlas/experiments";
import { closeWindow, dueWindows, WINDOW_SECONDS } from "@/lib/atlas/forecasts";
import type { AgentEvent } from "@/lib/server/events";
import { sleep } from "@/lib/server/http";

export const chainHooks: Hooks = { onSeal: sealOnChain, onTested: resolveOnChain };
const PACE = Number(process.env.AGENT_PACE_MS ?? 650);

type Pool = { day: string; genes: string[]; idx: number };

async function poolPage(index: number, size: number): Promise<{ symbol: string; score: number }[]> {
  const d = await getJSON<{ data: { disease: { associatedTargets: { count: number; rows: { score: number; target: { approvedSymbol: string } }[] } } } }>(
    "Open Targets", "https://api.platform.opentargets.org/api/v4/graphql",
    {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ disease(efoId:"${PD_ID}"){ associatedTargets(page:{index:${index},size:${size}}){ count rows{ score target{ approvedSymbol } } } } }` }),
    },
  );
  kvSet("pool_size", d.data.disease.associatedTargets.count);
  return d.data.disease.associatedTargets.rows.map((r) => ({ symbol: r.target.approvedSymbol, score: r.score }));
}

function recentlyRead(symbol: string, days: number) {
  return !!one("select 1 from runs where symbol = ? and at > ?", symbol, new Date(Date.now() - days * 864e5).toISOString());
}

export async function nextGene(): Promise<{ gene: string; source: string } | null> {
  const q = one<{ id: number; gene: string; source: string }>(
    "select id, gene, source from queue where done = 0 order by case source when 'holder' then 0 else 1 end, id limit 1",
  );
  if (q) {
    run("update queue set done = 1 where id = ?", q.id);
    return { gene: q.gene, source: q.source };
  }
  const pool = kvGet<Pool>("pool", { day: "", genes: [], idx: 0 });
  for (let tries = 0; tries < 400; tries++) {
    if (pool.idx >= pool.genes.length) {
      const page = Math.floor(pool.genes.length / 100);
      const rows = await poolPage(page, 100).catch(() => []);
      if (!rows.length) break;
      pool.genes.push(...rows.map((r) => r.symbol));
    }
    const gene = pool.genes[pool.idx++];
    if (gene && !recentlyRead(gene, 30)) {
      kvSet("pool", pool);
      return { gene, source: "pool" };
    }
  }
  kvSet("pool", pool);
  return null;
}

export const enqueue = (gene: string, source: string, wallet?: string) =>
  run("insert into queue (gene, at, source, wallet) values (?, ?, ?, ?)", gene, nowIso(), source, wallet ?? null);

export const queueLength = () => one<{ n: number }>("select count(*) as n from queue where done = 0")?.n ?? 0;

/** one gene, start to finish, into the live feed */
export async function workOne(gene: string, pace = PACE) {
  setStatus({ state: "working", gene });
  const rec = await investigate(gene, {
    source: "live", pace, atlas: true, swarm: true, hooks: chainHooks, window: WINDOW_SECONDS,
    emit: (e) => {
      pushEvent(e);
      if (e.k === "test" || e.k === "register") setStatus({ state: "testing", gene: e.gene ?? gene });
      if (e.k === "swarm" && e.fac === "swarm") setStatus({ state: "swarm", gene: e.gene ?? gene });
    },
  });
  return rec;
}

// ---------------------------------------------------------------- forecast windows
const pct = (p: number | null) => (p == null ? "n/a" : `${Math.round(p * 100)}%`);

/** close every window whose time is up: test the prediction, reveal the agent's forecast, score everyone's */
export async function closeWindows(pace = PACE) {
  const due = dueWindows();
  if (!due.length) return 0;
  const before = getStatus();
  const tested: Experiment[] = [];
  for (const registration of due) {
    const closed = closeWindow(registration);
    if (!closed) continue;
    const { exp, window: w } = closed;
    if (!w) {
      pushEvent({ gene: exp.gene, k: "forecast", x: `the window on ${exp.gene} (${AXIS_SHORT[exp.axis]}, ${exp.group}) closed, but it was sealed on an atlas that has since been replaced: voided, nothing scored.` });
      continue;
    }
    setStatus({ state: "testing", gene: exp.gene });
    const events: AgentEvent[] = [];
    const say = async (e: Omit<AgentEvent, "gene">) => {
      const ev = { gene: exp.gene, ...e } as AgentEvent;
      events.push(ev);
      pushEvent(ev);
      if (pace) await sleep(pace);
    };
    const others = w.forecasts.length;
    const people = w.crowd.n, agents = others - people;
    const who = others
      ? `${people ? `${people} ${people === 1 ? "person" : "people"}${w.crowd.p != null ? ` (crowd ${pct(w.crowd.p)})` : ""}` : ""}${people && agents ? " and " : ""}${agents ? `${agents} ${agents === 1 ? "agent" : "agents"}` : ""} forecast it`
      : "nobody forecast it";
    await say({ k: "forecast", x: `the window on ${exp.gene} (${AXIS_SHORT[exp.axis]}, ${exp.group}) closed: ${who}. my sealed forecast was ${pct(w.house.p)}; salt ${w.house.salt.slice(0, 8)}…, and it hashes to the seal.` });
    await narrateResult(exp, { swarm: true }, say);
    const beat = w.forecasts.filter((f) => f.brier < w.house.brier).sort((a, b) => a.brier - b.brier);
    const names = beat.slice(0, 3).map((f) => `${f.name ?? "an anonymous forecaster"} at ${pct(f.p)}`).join(", ");
    await say({
      k: "forecast",
      x: others
        ? `scored (Brier, lower is better): me ${w.house.brier.toFixed(3)}${w.crowd.brier != null ? `, the crowd ${w.crowd.brier.toFixed(3)}` : ""}. ${beat.length ? `closer than me: ${names}${beat.length > 3 ? ` and ${beat.length - 3} more` : ""}.` : "nobody came closer than me this time."}`
        : `scored: me ${w.house.brier.toFixed(3)} (Brier, lower is better).`,
    });
    appendRunEvents(exp.gene, events);
    tested.push(exp);
  }
  await resolveOnChain(tested).catch((e) => console.error("[james] resolve", e?.message ?? e));
  setStatus({ ...before });
  return tested.length;
}

// ---------------------------------------------------------------- nightly notebook
export async function nightly(): Promise<void> {
  const night = new Date().toISOString().slice(0, 10);
  if (one("select 1 from notebook where night = ?", night)) return;
  pushEvent({ gene: null, k: "say", x: "nightly run: reading the 80 best-scored Parkinson's targets on Open Targets. this takes a few minutes." });
  const rows = (await poolPage(0, 80).catch(() => [])).map((r) => r.symbol);
  const kept: { symbol: string; score: number }[] = [];
  let receipts = 0;
  for (const symbol of rows) {
    const rec = await investigate(symbol, { source: "nightly", emit: () => undefined, atlas: true, swarm: true, hooks: chainHooks }).catch(() => null);
    if (!rec) continue;
    if (rec.receipt) receipts++;
    if (rec.passed) kept.push({ symbol: rec.symbol, score: rec.score });
  }
  kept.sort((a, b) => b.score - a.score);
  const top = kept.slice(0, 12);
  run(
    "insert into notebook (night, at, pool, investigated, data) values (?, ?, ?, ?, ?) on conflict(night) do update set at = excluded.at, investigated = excluded.investigated, data = excluded.data",
    night, nowIso(), kvGet<number>("pool_size", 0), rows.length, JSON.stringify(top),
  );
  pushEvent({ gene: null, k: "say", x: `nightly run done: ${rows.length} genes read, ${top.length} kept for the notebook, ${receipts} receipts printed.` });
}

// ---------------------------------------------------------------- the loop
const g = globalThis as unknown as { __jamesWorker?: { started: boolean; busy: boolean; lastChore: number; lastSay: number } };

async function chores() {
  // the gym seals its tuned analyst weights once, as soon as there is enough to fit them on
  try {
    const seal = sealGymIfReady();
    if (seal) pushEvent({ gene: null, k: "say", x: `the gym sealed its tuned analyst weights after ${seal.n_train} training tasks: ${seal.hash.slice(0, 16)}. from now on they are scored only on predictions made after this moment.` });
  } catch (e) {
    console.error("[james] gym", e instanceof Error ? e.message : e);
  }
  if ((await chainMode()) === "off") return;
  await syncOnchainPredictions().catch((e) => console.error("[james] sync", e?.message ?? e));
  await anchorReceipts().catch((e) => console.error("[james] anchor", e?.message ?? e));
}

async function step() {
  const w = g.__jamesWorker!;
  if (w.busy) return;
  w.busy = true;
  try {
    const now = new Date();
    if (Date.now() - w.lastChore > 5 * 60_000) { w.lastChore = Date.now(); await chores(); }
    await closeWindows();
    if (now.getUTCHours() === 2 && now.getUTCMinutes() >= 30 && kvGet("nightly_last", "") !== now.toISOString().slice(0, 10)) {
      kvSet("nightly_last", now.toISOString().slice(0, 10));
      setStatus({ state: "working", gene: "nightly run" });
      await nightly();
    }
    const st = getStatus();
    const due = !st.next_at || Date.parse(st.next_at) <= Date.now() || queueLength() > 0;
    if (st.state === "working" || st.state === "testing" || st.state === "swarm" || due) {
      const next = await nextGene();
      if (!next) {
        setStatus({ state: "idle", note: "queue empty; waiting for the nightly run", next_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      } else {
        const rec = await workOne(next.gene);
        // a sealed study waiting in the queue runs between genes, in public
        const study = nextStudy();
        if (study) {
          setStatus({ state: "testing", gene: study.short });
          await runStudy(study.id, { emit: pushEvent, pace: PACE }).catch((e) => console.error("[james] study", e?.message ?? e));
        }
        setStatus({ state: "waiting", last: rec?.symbol ?? next.gene, next_at: new Date(Date.now() + agentInterval() * 1000).toISOString() });
      }
    } else if (Date.now() - w.lastSay > 7 * 60_000) {
      w.lastSay = Date.now();
      pushEvent({ gene: null, k: "say", x: MUSINGS[Math.floor(Math.random() * MUSINGS.length)] });
    }
  } catch (e) {
    console.error("[james] worker step failed:", e instanceof Error ? e.message : e);
    setStatus({ state: "waiting", next_at: new Date(Date.now() + 60_000).toISOString() });
  } finally {
    w.busy = false;
  }
}

export function startWorker() {
  if (g.__jamesWorker?.started) return;
  g.__jamesWorker = { started: true, busy: false, lastChore: 0, lastSay: Date.now() };
  // a gene that was mid-run when the server stopped is simply skipped; the loop picks the next one
  setStatus({ state: "waiting", next_at: new Date(Date.now() + 8000).toISOString() });
  setInterval(step, 5000).unref?.();
  console.log(`[james] agent loop started: a gene every ${agentInterval()}s`);
}

export const workerStarted = () => !!g.__jamesWorker?.started;
export const notebookNights = (limit = 7) =>
  all<{ night: string; at: string; pool: number; investigated: number; data: string }>("select * from notebook order by night desc limit ?", limit);
