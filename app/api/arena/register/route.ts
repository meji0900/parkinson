export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { registerAgent } from "@/lib/arena";
import { body, fail, ok } from "@/lib/server/api";
import { clientIp, limit } from "@/lib/server/ratelimit";

// For agents that do not speak MCP: POST { name, about?, homepage? } and keep the key it returns.
export async function POST(req: Request) {
  if (!limit(`register:${clientIp(req)}`, 5, 864e5).ok) return fail("five registrations a day per connection", 429);
  const r = registerAgent(await body<{ name: string; about: string; homepage: string }>(req));
  return "error" in r ? fail(r.error!) : ok(r);
}
