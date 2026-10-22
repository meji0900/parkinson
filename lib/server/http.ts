// Outbound calls to the public sources: timeout, one retry, and a small in-memory cache.
const UA = "parkinson-research-agent/1.0 (+open Parkinson's research notebook)";

type Cached = { at: number; value: unknown };
const g = globalThis as unknown as { __parkinsonHttpCache?: Map<string, Cached> };
const cache = (g.__parkinsonHttpCache ??= new Map());
const TTL = 6 * 60 * 60 * 1000;

export class SourceError extends Error {
  constructor(public source: string, message: string) {
    super(`${source}: ${message}`);
  }
}

async function once(url: string, init: RequestInit | undefined, ms: number) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(ms),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getJSON<T>(source: string, url: string, init?: RequestInit, ms = 15000): Promise<T> {
  const key = (init?.method ?? "GET") + " " + url + " " + (typeof init?.body === "string" ? init.body : "");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const value = await once(url, init, ms);
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
      return value as T;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw new SourceError(source, last instanceof Error ? last.message : String(last));
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
