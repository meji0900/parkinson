export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { cleanName, body, fail, ok } from "@/lib/server/api";
import { closedWindows, openWindows, personOf, scoreboard, submitForecast } from "@/lib/atlas/forecasts";
import { clientIp, limit } from "@/lib/server/ratelimit";

// The forecast window over plain HTTP.
//   GET  /api/forecasts                  what is open, what closed lately, the scoreboard
//   POST /api/forecasts { registration, p, token, name }
// A person is known by a random token their browser keeps; only a hash of it is stored.

export function GET() {
  return ok({ now: new Date().toISOString(), open: openWindows(), closed: closedWindows(12), board: scoreboard() });
}

export async function POST(req: Request) {
  const b = await body<{ registration: string; p: number; token: string; name: string }>(req);
  if (typeof b.token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(b.token)) return fail("missing forecaster token");
  if (!limit(`forecast:${clientIp(req)}`, 60, 3600_000).ok) return fail("that is a lot of forecasts for one hour; try again later", 429);
  const r = submitForecast(b.registration, b.p, { who: personOf(b.token), kind: "person", name: cleanName(b.name) });
  return r.ok ? ok({ ...r, who: personOf(b.token) }) : fail(r.error);
}
