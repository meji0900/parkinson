// The forecast window. When the live agent seals a prediction it does not test it straight away: for a few
// minutes anyone can say how likely it is to hold in both donor halves, people on the forecast page and
// registered agents over MCP. The agent seals its own forecast as a hash at the same moment and reveals the
// number when the window closes, so nobody can copy it and it cannot be changed after the fact. Forecasts
// stay hidden until the close too, so nobody herds. Then the prediction is tested and every forecast is
// scored with the Brier score: the squared distance between the probability and what happened (0 is
// perfect). The fair comparison is on the same predictions, so skill is measured against the agent's
// forecast on each one.
import { createHash, randomBytes } from "node:crypto";
import { all, nowIso, one, run, tx } from "@/lib/server/db";
import { hashOf } from "@/lib/server/hash";
import { cohorts, type Axis, type Group } from "./cohort";
import { getExperiment, test, type Experiment } from "./experiments";

export const WINDOW_SECONDS = Math.max(0, Number(process.env.FORECAST_WINDOW_SECONDS ?? 600));
export const HOUSE = "house:james";
/** forecasters are ranked once this many of their forecasts have been scored */
export const RANKED_AFTER = 3;

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const r3 = (x: number) => Math.round(x * 1000) / 1000;

type WindowRow = { registration: string; opened: string; closes: string; agent_p: number; agent_salt: string; agent_commit: string; closed: string | null };

/**
 * The agent's own forecast, from its record and nothing else: the share of its earlier predictions of the same
 * kind (cell group and outcome) that held, shrunk toward its overall rate while it has seen few of that kind.
 */
export function houseForecast(group: Group, axis: Axis): number {
  const c = cohorts().primary.id;
  const every = one<{ n: number; k: number }>("select count(*) as n, coalesce(sum(passed), 0) as k from experiments where state = 'tested' and cohort = ?", c) ?? { n: 0, k: 0 };
  const same = one<{ n: number; k: number }>(
    "select count(*) as n, coalesce(sum(passed), 0) as k from experiments where state = 'tested' and cohort = ? and grp = ? and axis = ?", c, group, axis,
  ) ?? { n: 0, k: 0 };
  const base = (every.k + 1) / (every.n + 2);
  return r3(Math.min(0.98, Math.max(0.02, (same.k + 10 * base) / (same.n + 10))));
}

/** the commitment that seals the agent's forecast: anyone can recompute it once the number and salt are out */
export const commitOf = (registration: string, p: number, salt: string) => hashOf({ p, registration, salt });

export function openWindow(exp: Experiment, seconds = WINDOW_SECONDS): { closes: string; commit: string } {
  const have = one<WindowRow>("select * from windows where registration = ?", exp.registration);
  if (have) return { closes: have.closes, commit: have.agent_commit };
  const p = houseForecast(exp.group, exp.axis);
  const salt = randomBytes(16).toString("hex");
  const commit = commitOf(exp.registration, p, salt);
  const opened = nowIso(), closes = iso(Date.now() + seconds * 1000);
  tx(() => {
    run("insert into windows (registration, opened, closes, agent_p, agent_salt, agent_commit) values (?, ?, ?, ?, ?, ?)", exp.registration, opened, closes, p, salt, commit);
    run("insert into forecasts (registration, who, kind, name, p, at) values (?, ?, 'house', 'james', ?, ?)", exp.registration, HOUSE, p, opened);
  });
  return { closes, commit };
}

export type Forecaster = { who: string; kind: "person" | "agent"; name: string | null };

/** a person is known by a random token their browser keeps; only a hash of it is stored or shown */
export const personOf = (token: string) => "person:" + createHash("sha256").update(token).digest("hex").slice(0, 20);

export function submitForecast(registration: unknown, prob: unknown, f: Forecaster) {
  if (typeof registration !== "string" || !/^[0-9a-f]{64}$/.test(registration)) return { ok: false as const, error: "give the prediction's registration hash" };
  const w = one<WindowRow>("select * from windows where registration = ?", registration);
  if (!w) return { ok: false as const, error: "that prediction is not open for forecasts" };
  if (w.closed || Date.parse(w.closes) <= Date.now()) return { ok: false as const, error: "the window on that prediction has closed" };
  const p = Number(prob);
  if (!Number.isFinite(p) || p < 0 || p > 1) return { ok: false as const, error: "the probability must be a number from 0 to 1" };
  run(
    `insert into forecasts (registration, who, kind, name, p, at) values (?, ?, ?, ?, ?, ?)
     on conflict(registration, who) do update set p = excluded.p, name = excluded.name, at = excluded.at`,
    registration, f.who, f.kind, f.name, r3(p), nowIso(),
  );
  const n = one<{ n: number }>("select count(*) as n from forecasts where registration = ? and kind != 'house'", registration)?.n ?? 0;
  return { ok: true as const, registration, p: r3(p), closes: w.closes, forecasts: n };
}

/** windows whose time is up and whose prediction has not been tested yet, oldest first */
export const dueWindows = () =>
  all<{ registration: string }>("select registration from windows where closed is null and closes <= ? order by closes", nowIso()).map((r) => r.registration);

/** test the prediction, score every forecast on it, reveal the agent's number */
export function closeWindow(registration: string) {
  const w = one<WindowRow>("select * from windows where registration = ?", registration);
  if (!w || w.closed) return null;
  const exp = test(registration);
  const y = exp.passed ? 1 : 0;
  tx(() => {
    run("update forecasts set y = ?, brier = (p - ?) * (p - ?) where registration = ?", y, y, y, registration);
    run("update windows set closed = ? where registration = ?", nowIso(), registration);
  });
  return { exp, window: closedOne(registration)! };
}

// ---------------------------------------------------------------- reading the windows back
export type OpenWindow = {
  registration: string; gene: string; group: Group; axis: Axis; sealed: string; opened: string; closes: string; commit: string; forecasts: number;
};

export function openWindows(): OpenWindow[] {
  return all<OpenWindow & { grp: Group }>(
    `select w.registration, e.gene, e.grp, e.axis, e.at as sealed, w.opened, w.closes, w.agent_commit as "commit",
       (select count(*) from forecasts f where f.registration = w.registration and f.kind != 'house') as forecasts
     from windows w join experiments e on e.registration = w.registration where w.closed is null order by w.closes, e.gene`,
  ).map(({ grp, ...r }) => ({ ...r, group: grp }));
}

export type ClosedWindow = {
  registration: string; gene: string; group: Group; axis: Axis; closes: string; closed: string; held: boolean; reason: string | null; receipt: number | null;
  house: { p: number; salt: string; commit: string; brier: number };
  crowd: { n: number; p: number | null; brier: number | null };
  forecasts: { kind: "person" | "agent"; name: string | null; who: string; p: number; brier: number }[];
};

function shape(w: WindowRow, e: Experiment, fs: { kind: string; name: string | null; who: string; p: number; brier: number | null }[]): ClosedWindow {
  const y = e.passed ? 1 : 0;
  const people = fs.filter((f) => f.kind === "person");
  const crowdP = people.length ? people.reduce((a, f) => a + f.p, 0) / people.length : null;
  return {
    registration: w.registration, gene: e.gene, group: e.group, axis: e.axis, closes: w.closes, closed: w.closed!, held: !!e.passed, reason: e.reason, receipt: e.receipt,
    house: { p: w.agent_p, salt: w.agent_salt, commit: w.agent_commit, brier: r3((w.agent_p - y) ** 2) },
    crowd: { n: people.length, p: crowdP == null ? null : r3(crowdP), brier: crowdP == null ? null : r3((crowdP - y) ** 2) },
    forecasts: fs.filter((f) => f.kind !== "house").map((f) => ({ kind: f.kind as "person" | "agent", name: f.name, who: f.who, p: f.p, brier: r3(f.brier ?? (f.p - y) ** 2) })),
  };
}

function closedOne(registration: string): ClosedWindow | null {
  const w = one<WindowRow>("select * from windows where registration = ? and closed is not null", registration);
  const e = getExperiment(registration);
  if (!w || !e) return null;
  return shape(w, e, all("select kind, name, who, p, brier from forecasts where registration = ? order by at", registration));
}

export function closedWindows(limit = 20, opts: { who?: string } = {}): ClosedWindow[] {
  const rows = opts.who
    ? all<WindowRow>("select w.* from windows w join forecasts f on f.registration = w.registration and f.who = ? where w.closed is not null order by w.closed desc limit ?", opts.who, limit)
    : all<WindowRow>("select * from windows where closed is not null order by closed desc limit ?", limit);
  return rows.flatMap((w) => {
    const e = getExperiment(w.registration);
    return e ? [shape(w, e, all("select kind, name, who, p, brier from forecasts where registration = ? order by at", w.registration))] : [];
  });
}

// ---------------------------------------------------------------- the scoreboard
export type ForecasterRow = { who: string; kind: "person" | "agent"; name: string | null; n: number; brier: number; skill: number; gain: number; ranked: boolean };

/** every forecaster of one kind, scored on the windows that have closed, best skill against the agent first */
export function forecasters(kind: "person" | "agent", limit = 50): ForecasterRow[] {
  const rows = all<{ who: string; name: string | null; n: number; brier: number; skill: number; gain: number }>(
    `select f.who, (select name from forecasts x where x.who = f.who order by x.at desc limit 1) as name,
       count(*) as n, avg(f.brier) as brier, avg(h.brier - f.brier) as skill, sum(h.brier - f.brier) as gain
     from forecasts f join forecasts h on h.registration = f.registration and h.who = ?
     where f.kind = ? and f.y is not null group by f.who`,
    HOUSE, kind,
  );
  return rows
    .map((r) => ({ ...r, kind, brier: r3(r.brier), skill: r3(r.skill), gain: r3(r.gain), ranked: r.n >= RANKED_AFTER }))
    .sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.skill - a.skill || b.n - a.n)
    .slice(0, limit);
}

export function scoreboard() {
  // the crowd is the average of the people who forecast a prediction; compared with the agent on those only
  const rows = all<{ registration: string; y: number; house: number; crowd: number | null; people: number }>(
    `select h.registration, h.y, h.p as house,
       (select avg(p) from forecasts f where f.registration = h.registration and f.kind = 'person') as crowd,
       (select count(*) from forecasts f where f.registration = h.registration and f.kind = 'person') as people
     from forecasts h where h.who = ? and h.y is not null`,
    HOUSE,
  );
  const both = rows.filter((r) => r.people > 0 && r.crowd != null);
  const mean = (xs: number[]) => (xs.length ? r3(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const open = one<{ n: number }>("select count(*) as n from windows where closed is null")?.n ?? 0;
  return {
    window_seconds: WINDOW_SECONDS,
    open,
    closed: rows.length,
    held: rows.filter((r) => r.y === 1).length,
    house: { brier: mean(rows.map((r) => (r.house - r.y) ** 2)) },
    crowd_vs_house: { n: both.length, crowd: mean(both.map((r) => (r.crowd! - r.y) ** 2)), house: mean(both.map((r) => (r.house - r.y) ** 2)) },
    people: forecasters("person", 30),
    agents: forecasters("agent", 30),
  };
}
