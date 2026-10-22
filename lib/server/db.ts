// The ledgers. One SQLite file through Node's built-in driver: no database service to run.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
create table if not exists events (
  seq integer primary key autoincrement, ts text not null, gene text, k text not null, fac text, x text, data text
);
create table if not exists runs (
  id integer primary key autoincrement, symbol text not null, ensg text, name text, at text not null,
  score real, passed integer, source text, record text, events text
);
create index if not exists runs_symbol on runs(symbol, at);
create index if not exists runs_at on runs(at);
create table if not exists receipts (
  no integer primary key, at text not null, subject text, kind text, body text not null, hash text not null, prev text not null
);
create table if not exists experiments (
  registration text primary key, gene text not null, grp text not null, axis text not null, cohort text not null,
  protocol integer not null, at text not null, by text, wallet text, source text not null,
  state text not null default 'sealed', passed integer, reason text, receipt integer,
  discovery text, replication text, checks text, chain_tx text, resolve_tx text, reward_tx text, chain_status text
);
create index if not exists experiments_gene on experiments(gene);
create index if not exists experiments_at on experiments(at);
create table if not exists visits (
  id integer primary key autoincrement, at text not null, registration text not null, by text, wallet text, repeat integer
);
create table if not exists swarm_cases (
  receipt integer primary key, gene text, grp text, axis text, opened text, data text
);
create table if not exists followups (
  registration text primary key, case_receipt integer, gene text, grp text, axis text, at text,
  region text, result text, passed integer, same_sign integer
);
create table if not exists anchors (
  id integer primary key autoincrement, at text not null, head_no integer, head_hash text, tx text
);
create table if not exists faucet (id integer primary key autoincrement, wallet text, ip text, at text, tx text);
create table if not exists queue (
  id integer primary key autoincrement, gene text not null, at text not null, source text, wallet text, done integer default 0
);
create table if not exists pending_tx (
  registration text primary key, wallet text, message text, by text, gene text, grp text, axis text, at text
);
create table if not exists notebook (night text primary key, at text, pool integer, investigated integer, data text);
create table if not exists kv (k text primary key, v text);
create table if not exists studies (
  registration text primary key, id text not null, cohort text not null, at text not null, state text not null,
  def text not null, result text, receipt integer
);
create table if not exists work_units (
  study text not null, unit integer not null, seed integer not null, shuffles integer not null, count integer,
  by text, at text, primary key (study, unit)
);
create table if not exists proposals (
  id integer primary key autoincrement, at text not null, by text, gene text, grp text, text text, ip text
);
create table if not exists windows (
  registration text primary key, opened text not null, closes text not null,
  agent_p real not null, agent_salt text not null, agent_commit text not null, closed text
);
create index if not exists windows_open on windows(closed, closes);
create table if not exists forecasts (
  registration text not null, who text not null, kind text not null, name text, p real not null, at text not null,
  y integer, brier real, primary key (registration, who)
);
create index if not exists forecasts_who on forecasts(who, kind);
create table if not exists agents (
  id text primary key, name text not null, name_key text not null unique, about text, homepage text,
  key_hash text not null unique, at text not null, ip text
);
`;

// columns added after the first release, so ledgers made before them are upgraded in place
const COLUMNS: [table: string, column: string, type: string][] = [
  ["experiments", "agent", "text"],
  ["work_units", "agent", "text"],
  ["proposals", "agent", "text"],
  // on-chain records keep the chain id they were written to
  ["experiments", "chain", "text"],
  ["anchors", "chain", "text"],
  ["faucet", "chain", "text"],
];

const g = globalThis as unknown as { __parkinsonDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__parkinsonDb) return g.__parkinsonDb;
  // JAMES_DB is the name the variable had before the rename; deployments that still set it keep their ledger
  const file = process.env.PARKINSON_DB ?? process.env.JAMES_DB ?? path.join(process.cwd(), "data", "parkinson.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec("pragma journal_mode = wal; pragma busy_timeout = 5000; pragma synchronous = normal;");
  d.exec(SCHEMA);
  for (const [t, c, type] of COLUMNS) {
    const have = d.prepare(`pragma table_info(${t})`).all() as { name: string }[];
    if (!have.some((x) => x.name === c)) d.exec(`alter table ${t} add column ${c} ${type}`);
  }
  d.exec("create index if not exists experiments_agent on experiments(agent)");
  // the house's forecasts were filed under its brand ("house:james"); the key is brand-free now
  d.exec("update forecasts set who = 'house', name = null where who like 'house:%'");
  g.__parkinsonDb = d;
  return d;
}

type Row = Record<string, unknown>;
export const all = <T = Row>(sql: string, ...p: SQLInputValue[]) => db().prepare(sql).all(...p) as T[];
export const one = <T = Row>(sql: string, ...p: SQLInputValue[]) => db().prepare(sql).get(...p) as T | undefined;
export const run = (sql: string, ...p: SQLInputValue[]) => db().prepare(sql).run(...p);

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("begin immediate");
  try {
    const out = fn();
    d.exec("commit");
    return out;
  } catch (e) {
    d.exec("rollback");
    throw e;
  }
}

export function kvGet<T>(k: string, fallback: T): T {
  const r = one<{ v: string }>("select v from kv where k = ?", k);
  if (!r) return fallback;
  try {
    return JSON.parse(r.v) as T;
  } catch {
    return fallback;
  }
}
export const kvSet = (k: string, v: unknown) =>
  run("insert into kv (k, v) values (?, ?) on conflict(k) do update set v = excluded.v", k, JSON.stringify(v));

export const json = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== "string") return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
