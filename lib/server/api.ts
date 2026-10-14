export const ok = (data: unknown, init?: ResponseInit) =>
  Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
export const fail = (error: string, status = 400) => ok({ error }, { status });

export async function body<T>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export const cleanGene = (s: unknown) => (typeof s === "string" ? s.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16) : "");
export const cleanName = (s: unknown) => (typeof s === "string" ? s.replace(/[^\p{L}\p{N} ._@-]/gu, "").trim().slice(0, 40) || null : null);
