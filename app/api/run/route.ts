export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { investigate, storedEvents } from "@/lib/agent/pipeline";
import { chainHooks } from "@/lib/agent/worker";
import { cleanGene, fail } from "@/lib/server/api";
import { clientIp, limit } from "@/lib/server/ratelimit";

// Streams one investigation as newline-delimited JSON events. A gene read in the last 12 hours is
// replayed from its stored events instead of hitting the six sources again.
export async function GET(req: Request) {
  const gene = cleanGene(new URL(req.url).searchParams.get("gene"));
  if (!gene) return fail("give a gene symbol, e.g. ?gene=TREM2");
  const ip = clientIp(req);
  const enc = new TextEncoder();
  const stored = storedEvents(gene, 12);
  if (stored) {
    if (!limit(`replay:${ip}`, 120, 3600_000).ok) return fail("too many requests; try again later", 429);
    const text = stored.map((e) => JSON.stringify(e)).join("\n") + "\n";
    return new Response(text, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  }
  const rl = limit(`run:${ip}`, Number(process.env.RUNS_PER_HOUR ?? 12), 3600_000);
  if (!rl.ok) return fail(`you have started a lot of fresh runs; try again in ${Math.ceil(rl.retryIn / 60)} minutes`, 429);
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await investigate(gene, {
          source: "visitor", atlas: true, swarm: true, hooks: chainHooks,
          emit: (e) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n")),
        });
      } catch (e) {
        controller.enqueue(enc.encode(JSON.stringify({ k: "stop", x: "something broke mid-run: " + (e instanceof Error ? e.message : String(e)) }) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
