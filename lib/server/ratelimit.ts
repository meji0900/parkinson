// Fixed-window counters per key, kept in memory (enough for one server process).
type Window = { start: number; n: number };
const g = globalThis as unknown as { __jamesRate?: Map<string, Window> };
const windows = (g.__jamesRate ??= new Map());

export function limit(key: string, max: number, windowMs: number): { ok: boolean; retryIn: number } {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, n: 1 });
    return { ok: true, retryIn: 0 };
  }
  if (w.n >= max) return { ok: false, retryIn: Math.ceil((w.start + windowMs - now) / 1000) };
  w.n++;
  return { ok: true, retryIn: 0 };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}
