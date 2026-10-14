export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ask } from "@/lib/agent/ask";
import { fail, ok } from "@/lib/server/api";
import { clientIp, limit } from "@/lib/server/ratelimit";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return fail("ask something");
  if (!limit(`ask:${clientIp(req)}`, 30, 3600_000).ok) return ok({ lines: ["that's a lot of questions for one hour. the records are all on this page."] });
  return ok(await ask(q));
}
