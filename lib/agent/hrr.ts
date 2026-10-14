// Holographic merge: each reader's finding is bound to its role by circular convolution and the six are
// superposed into one 1,024-number vector. The agent then unbinds each role again; if every finding
// comes back out (cosine with the right answer beats every wrong one) the merge is trusted.
import { hashOf } from "@/lib/server/hash";
import { FACETS, type Facet, type Level } from "./types";

const D = 1024;
const LEVELS: Level[] = ["strong", "moderate", "weak", "absent"];

function seeded(name: string) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const memo = new Map<string, Float64Array>();
function vec(name: string): Float64Array {
  let v = memo.get(name);
  if (v) return v;
  const r = seeded("engram:" + name);
  v = new Float64Array(D);
  const sd = 1 / Math.sqrt(D);
  for (let i = 0; i < D; i += 2) {
    const u = Math.max(r(), 1e-12), w = r();
    const m = Math.sqrt(-2 * Math.log(u)) * sd;
    v[i] = m * Math.cos(2 * Math.PI * w);
    v[i + 1] = m * Math.sin(2 * Math.PI * w);
  }
  memo.set(name, v);
  return v;
}

function bind(a: Float64Array, b: Float64Array): Float64Array {
  const c = new Float64Array(D);
  for (let k = 0; k < D; k++) {
    let s = 0;
    for (let i = 0; i < D; i++) s += a[i] * b[(k - i + D) % D];
    c[k] = s;
  }
  return c;
}

function unbind(a: Float64Array, m: Float64Array): Float64Array {
  const c = new Float64Array(D);
  for (let k = 0; k < D; k++) {
    let s = 0;
    for (let i = 0; i < D; i++) s += a[i] * m[(k + i) % D];
    c[k] = s;
  }
  return c;
}

function cos(a: Float64Array, b: Float64Array) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < D; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return ab / Math.sqrt(aa * bb || 1);
}

export type Recovery = Record<Facet, { cos: number; next: number; ok: boolean }>;

export function merge(levels: Record<Facet, Level>): { sha: string; recovered: Recovery } {
  const m = new Float64Array(D);
  for (const f of FACETS) {
    const b = bind(vec("role:" + f), vec(`${f}:${levels[f]}`));
    for (let i = 0; i < D; i++) m[i] += b[i];
  }
  const recovered = {} as Recovery;
  for (const f of FACETS) {
    const y = unbind(vec("role:" + f), m);
    const right = cos(y, vec(`${f}:${levels[f]}`));
    const wrong = Math.max(...LEVELS.filter((l) => l !== levels[f]).map((l) => cos(y, vec(`${f}:${l}`))));
    recovered[f] = { cos: Math.round(right * 100) / 100, next: Math.round(wrong * 100) / 100, ok: right > wrong };
  }
  const sha = hashOf(Array.from(m, (x) => Math.round(x * 1e4))).slice(0, 12);
  return { sha, recovered };
}

export const DIM = D;
