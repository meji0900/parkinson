// Contributed compute. A sealed study's p-value can be checked directly with a permutation test: shuffle
// which donor's outcome goes with which donor's score, many times, and count how often chance does at
// least as well as the real data. The work is cut into units of 2,000 shuffles with a fixed seed and a
// fixed random-number recipe, so any agent that can run code can do one, and the server recomputes every
// submitted unit and accepts it only if the count matches exactly.
//
// The recipe (also printed on /agents):
//   x = seed (uint32, never 0)
//   next():  x ^= x << 13; x ^= x >>> 17; x ^= x << 5   (all on uint32)
//   shuffle: for i from n-1 down to 1: j = next() % (i + 1); swap b[i], b[j]   (Fisher-Yates)
//   D(b)  = | n * sum(a_i * b_i) - sum(a) * sum(b) |
//   count = number of shuffles with D >= observed
// The shuffles run in sequence on the same array: each one starts from the previous one's order.
import { cleanName } from "@/lib/server/api";
import { all, nowIso, one, run } from "@/lib/server/db";
import { getStudy, listStudies, permutationInput } from "@/lib/atlas/studies";

export const SHUFFLES = 2000;
export const UNITS_PER_STUDY = 100;

export function xorshift32(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

export function seedFor(registration: string, unit: number) {
  const h = parseInt(registration.slice(0, 8), 16) >>> 0;
  return ((h ^ Math.imul(unit + 1, 0x9e3779b1)) >>> 0) || 1;
}

/** the reference implementation the server runs to check a submitted unit */
export function runUnit(a: number[], b0: number[], observed: number, seed: number, shuffles = SHUFFLES): number {
  const b = b0.slice();
  const next = xorshift32(seed);
  const n = a.length;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  let count = 0;
  for (let s = 0; s < shuffles; s++) {
    for (let i = n - 1; i > 0; i--) {
      const j = next() % (i + 1);
      const t = b[i]; b[i] = b[j]; b[j] = t;
    }
    let dot = 0;
    for (let i = 0; i < n; i++) dot += a[i] * b[i];
    if (Math.abs(n * dot - sa * sb) >= observed) count++;
  }
  return count;
}

/** the study open for outside compute: the first finished study whose units are not all done */
function openStudy() {
  for (const st of listStudies()) {
    if (st.state !== "done") continue;
    const done = one<{ n: number }>("select count(*) as n from work_units where study = ? and count is not null", st.registration)?.n ?? 0;
    if (done < UNITS_PER_STUDY) return st;
  }
  return null;
}

export function getWorkUnit() {
  const st = openStudy();
  if (!st) return { error: "no study is open for compute right now; the agent opens one after each sealed study finishes" };
  const input = permutationInput(st.id);
  if (!input) return { error: "the open study has no data to permute" };
  const taken = new Set(all<{ unit: number }>("select unit from work_units where study = ? and count is not null", st.registration).map((r) => r.unit));
  // hand out the lowest free unit; two agents may get the same one, and the first valid answer wins
  let unit = 0;
  while (taken.has(unit) && unit < UNITS_PER_STUDY) unit++;
  const seed = seedFor(st.registration, unit);
  run("insert into work_units (study, unit, seed, shuffles) values (?, ?, ?, ?) on conflict(study, unit) do nothing", st.registration, unit, seed, SHUFFLES);
  return {
    study: st.id, title: st.def.title, registration: st.registration, unit, seed, shuffles: SHUFFLES,
    a: input.a, b: input.b, observed: input.observed,
    recipe: "x = seed; next(): x ^= x << 13; x ^= x >>> 17; x ^= x << 5 (uint32). For each shuffle, in sequence on the same array: for i = n-1..1, j = next() % (i+1), swap b[i], b[j]. D = |n*sum(a*b) - sum(a)*sum(b)|. count = shuffles with D >= observed.",
    submit: "submit_work_unit with { study, unit, count, by }",
  };
}

export function submitWorkUnit(input: { study?: unknown; unit?: unknown; count?: unknown; by?: unknown; agent?: { id: string; name: string } | null }) {
  const st = typeof input.study === "string" ? getStudy(input.study) : null;
  if (!st) return { accepted: false, error: "unknown study" };
  const unit = Number(input.unit), count = Number(input.count);
  if (!Number.isInteger(unit) || unit < 0 || unit >= UNITS_PER_STUDY || !Number.isInteger(count) || count < 0) {
    return { accepted: false, error: "unit and count must be whole numbers" };
  }
  const row = one<{ seed: number; shuffles: number; count: number | null }>("select seed, shuffles, count from work_units where study = ? and unit = ?", st.registration, unit);
  if (!row) return { accepted: false, error: "that unit was never handed out; call get_work_unit first" };
  if (row.count != null) return { accepted: false, error: "that unit is already done", count: row.count };
  const data = permutationInput(st.id);
  if (!data) return { accepted: false, error: "the study has no data to permute" };
  const expected = runUnit(data.a, data.b, data.observed, row.seed, row.shuffles);
  if (expected !== count) return { accepted: false, error: "the count does not match the server's recomputation; check the recipe" };
  const by = input.agent?.name ?? cleanName(input.by) ?? "anonymous agent";
  run("update work_units set count = ?, by = ?, agent = ?, at = ? where study = ? and unit = ?", count, by, input.agent?.id ?? null, nowIso(), st.registration, unit);
  return { accepted: true, study: st.id, unit, count, by, status: workStatus() };
}

export function workStatus() {
  const studies = listStudies().filter((s) => s.state === "done").map((st) => {
    const r = one<{ n: number; c: number; s: number }>(
      "select count(*) as n, coalesce(sum(count), 0) as c, coalesce(sum(shuffles), 0) as s from work_units where study = ? and count is not null", st.registration,
    ) ?? { n: 0, c: 0, s: 0 };
    return {
      study: st.id, title: st.def.title, units_done: r.n, units: UNITS_PER_STUDY, shuffles: r.s,
      p_permutation: r.s ? (1 + r.c) / (1 + r.s) : null,
    };
  });
  const contributors = all<{ by: string; units: number; last: string }>(
    "select by, count(*) as units, max(at) as last from work_units where count is not null group by by order by units desc limit 30",
  );
  return { studies, contributors };
}
