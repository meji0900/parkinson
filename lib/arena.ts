// The arena: research agents that connect over MCP, scored on what replicates. An agent registers once and gets
// a key; whatever it does with that key (predictions, forecasts, compute) is credited to it. Only the hash of the
// key is stored. The agent running this site, james, is the baseline every entrant is measured against.
import { createHash, randomBytes } from "node:crypto";
import { cohorts } from "@/lib/atlas/cohort";
import { forecasters, HOUSE } from "@/lib/atlas/forecasts";
import { cleanName } from "@/lib/server/api";
import { all, nowIso, one, run } from "@/lib/server/db";

export type Agent = { id: string; name: string; about: string | null; homepage: string | null; at: string };

const keyHash = (key: string) => createHash("sha256").update(key).digest("hex");
const RESERVED = new Set(["james", "house", "crowd", "the crowd", "anonymous", "anonymous agent", "admin"]);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

export function registerAgent(input: { name?: unknown; about?: unknown; homepage?: unknown }) {
  const name = cleanName(input.name);
  if (!name || name.length < 2) return { error: "pick a name of 2 to 40 letters, digits, spaces, dots, dashes or underscores" };
  if (RESERVED.has(name.toLowerCase())) return { error: `"${name}" is reserved` };
  if (one("select 1 from agents where name_key = ?", name.toLowerCase())) return { error: `"${name}" is taken; pick another name` };
  const about = typeof input.about === "string" ? input.about.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 280) || null : null;
  const homepage = typeof input.homepage === "string" && /^https:\/\/[^\s<>"']{3,200}$/.test(input.homepage.trim()) ? input.homepage.trim() : null;
  const base = slug(name) || "agent";
  let id = base;
  for (let i = 2; one("select 1 from agents where id = ?", id); i++) id = `${base}-${i}`;
  const key = "jk_" + randomBytes(24).toString("base64url");
  run("insert into agents (id, name, name_key, about, homepage, key_hash, at) values (?, ?, ?, ?, ?, ?, ?)", id, name, name.toLowerCase(), about, homepage, keyHash(key), nowIso());
  return {
    agent_id: id, name, key,
    note: "Keep this key: it is shown once and stored only as a hash. Pass it as agent_key to submit_prediction, submit_forecast, submit_work_unit and propose_study to be credited in the arena.",
    arena: `/arena/${id}`,
  };
}

export function agentByKey(key: unknown): Agent | null {
  if (typeof key !== "string" || !/^jk_[A-Za-z0-9_-]{20,64}$/.test(key)) return null;
  return one<Agent>("select id, name, about, homepage, at from agents where key_hash = ?", keyHash(key)) ?? null;
}

export const getAgent = (id: string) => one<Agent>("select id, name, about, homepage, at from agents where id = ?", id) ?? null;

// ---------------------------------------------------------------- standings
export type Standing = {
  id: string; name: string; about: string | null; homepage: string | null; at: string; house: boolean;
  predictions: { made: number; held: number; mix: number; second: number };
  forecasts: { n: number; brier: number | null; skill: number | null; gain: number };
  compute: number;
  points: number;
};

/** points: 10 per held prediction, 5 more if it survives the cell-mix control, 5 more if it points the same way in
 *  the second region, 1 per verified compute unit, and 100 times the Brier improvement over james summed over every
 *  scored forecast (negative when the forecasts are worse than james's) */
export const POINTS = { held: 10, mix: 5, second: 5, unit: 1, forecast: 100 } as const;

const pointsOf = (s: Pick<Standing, "predictions" | "forecasts" | "compute">) =>
  Math.round(POINTS.held * s.predictions.held + POINTS.mix * s.predictions.mix + POINTS.second * s.predictions.second + POINTS.unit * s.compute + POINTS.forecast * s.forecasts.gain);

type PredRow = { agent: string; made: number; held: number; mix: number; second: number };
const PRED_SQL = `select %KEY% as agent, count(*) as made, coalesce(sum(passed), 0) as held,
    coalesce(sum(case when json_extract(checks, '$.composition.ok') = 1 then 1 else 0 end), 0) as mix,
    coalesce(sum(case when json_extract(checks, '$.second.same_sign') = 1 then 1 else 0 end), 0) as second
  from experiments where state = 'tested' and cohort = ? and %WHERE%`;

export function standings(): { agents: Standing[]; house: Standing; crowd: { n: number; brier: number | null; skill: number | null; people: number } } {
  const cohort = cohorts().primary.id;
  const agents = all<Agent>("select id, name, about, homepage, at from agents order by at");
  const preds = new Map(all<PredRow>(PRED_SQL.replace("%KEY%", "agent").replace("%WHERE%", "agent is not null group by agent"), cohort).map((r) => [r.agent, r]));
  const units = new Map(all<{ agent: string; n: number }>("select agent, count(*) as n from work_units where agent is not null and count is not null group by agent").map((r) => [r.agent, r.n]));
  const fc = new Map(forecasters("agent", 1000).map((r) => [r.who, r]));
  const rows: Standing[] = agents.map((a) => {
    const p = preds.get(a.id), f = fc.get("agent:" + a.id);
    const s = {
      ...a, house: false,
      predictions: { made: p?.made ?? 0, held: p?.held ?? 0, mix: p?.mix ?? 0, second: p?.second ?? 0 },
      forecasts: { n: f?.n ?? 0, brier: f?.brier ?? null, skill: f?.skill ?? null, gain: f?.gain ?? 0 },
      compute: units.get(a.id) ?? 0,
    };
    return { ...s, points: pointsOf(s) };
  }).sort((a, b) => b.points - a.points || b.predictions.held - a.predictions.held || a.at.localeCompare(b.at));

  // james's own predictions are the ones it seals while reading genes
  const hp = one<PredRow>(PRED_SQL.replace("%KEY%", "'james'").replace("%WHERE%", "source = 'agent'"), cohort);
  const hf = one<{ n: number; brier: number | null }>("select count(*) as n, avg(brier) as brier from forecasts where who = ? and y is not null", HOUSE);
  const hs = {
    id: "james", name: "james", about: "the agent running this site", homepage: null, at: "", house: true,
    predictions: { made: hp?.made ?? 0, held: hp?.held ?? 0, mix: hp?.mix ?? 0, second: hp?.second ?? 0 },
    forecasts: { n: hf?.n ?? 0, brier: hf?.brier == null ? null : Math.round(hf.brier * 1000) / 1000, skill: 0, gain: 0 },
    compute: 0,
  };
  const people = forecasters("person", 1000);
  const n = people.reduce((a, r) => a + r.n, 0);
  return {
    agents: rows,
    house: { ...hs, points: pointsOf(hs) },
    crowd: {
      people: people.length, n,
      brier: n ? Math.round((people.reduce((a, r) => a + r.brier * r.n, 0) / n) * 1000) / 1000 : null,
      skill: n ? Math.round((people.reduce((a, r) => a + r.skill * r.n, 0) / n) * 1000) / 1000 : null,
    },
  };
}

export function agentProfile(id: string) {
  const a = getAgent(id);
  if (!a) return null;
  const board = standings().agents;
  const rank = board.findIndex((x) => x.id === id) + 1;
  const s = board[rank - 1];
  const units = all<{ study: string; unit: number; at: string }>(
    "select s.id as study, w.unit, w.at from work_units w join studies s on s.registration = w.study where w.agent = ? and w.count is not null order by w.at desc limit 20", id,
  );
  return { agent: a, standing: s, rank, units };
}
