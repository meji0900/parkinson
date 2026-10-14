export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handle } from "@/lib/mcp";
import { clientIp, limit } from "@/lib/server/ratelimit";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!limit(`mcp:${clientIp(req)}`, 240, 3600_000).ok) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "rate limited" } }, { status: 429 });
  }
  let msg: unknown;
  try {
    msg = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400 });
  }
  if (Array.isArray(msg)) {
    const out = (await Promise.all(msg.map((m) => handle(m)))).filter(Boolean);
    return out.length ? new Response(JSON.stringify(out), { headers }) : new Response(null, { status: 202 });
  }
  const out = await handle(msg as Record<string, unknown>);
  return out ? new Response(JSON.stringify(out), { headers }) : new Response(null, { status: 202 });
}

export const GET = () =>
  new Response("this MCP server answers POST requests only (stateless streamable HTTP)", { status: 405, headers: { Allow: "POST" } });
