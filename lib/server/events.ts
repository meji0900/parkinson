// The live feed: every step the agent takes is an event with a sequence number. Pages poll
// /api/live?after=<seq> and type the new ones into the terminal.
import { all, kvGet, kvSet, nowIso, run } from "./db";

export type AgentEvent = {
  seq?: number;
  ts?: string;
  gene?: string | null;
  k: string;
  fac?: string;
  x: string;
  [extra: string]: unknown;
};

export type AgentStatus = {
  at: string;
  state: "starting" | "working" | "testing" | "swarm" | "waiting" | "idle" | "paused";
  gene?: string;
  last?: string;
  next_at?: string;
  receipt?: number;
  interval: number;
  note?: string;
};

export function pushEvent(e: AgentEvent): AgentEvent {
  const { k, fac, x, gene, seq: _s, ts: _t, ...rest } = e;
  const ts = nowIso();
  const r = run(
    "insert into events (ts, gene, k, fac, x, data) values (?, ?, ?, ?, ?, ?)",
    ts,
    gene ?? null,
    k,
    fac ?? null,
    x,
    Object.keys(rest).length ? JSON.stringify(rest) : null,
  );
  const seq = Number(r.lastInsertRowid);
  if (seq % 500 === 0) run("delete from events where seq < ?", seq - 6000);
  return { seq, ts, gene: gene ?? null, k, ...(fac ? { fac } : {}), x, ...rest };
}

type Row = { seq: number; ts: string; gene: string | null; k: string; fac: string | null; x: string; data: string | null };
const toEvent = (r: Row): AgentEvent => ({
  seq: r.seq,
  ts: r.ts,
  gene: r.gene,
  k: r.k,
  ...(r.fac ? { fac: r.fac } : {}),
  x: r.x,
  ...(r.data ? JSON.parse(r.data) : {}),
});

export function eventsAfter(after: number, limit = 60): AgentEvent[] {
  if (after <= 0) {
    // a fresh page gets the tail of the feed, not its whole history
    return all<Row>("select * from (select * from events order by seq desc limit ?) order by seq", limit).map(toEvent);
  }
  return all<Row>("select * from events where seq > ? order by seq limit ?", after, limit).map(toEvent);
}

const INTERVAL = Number(process.env.AGENT_INTERVAL_SECONDS ?? 150);

export const getStatus = (): AgentStatus =>
  kvGet<AgentStatus>("status", { at: nowIso(), state: "starting", interval: INTERVAL });

export const setStatus = (s: Omit<AgentStatus, "at" | "interval">) =>
  kvSet("status", { ...s, at: nowIso(), interval: INTERVAL });

export const agentInterval = () => INTERVAL;
