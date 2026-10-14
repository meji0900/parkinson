// Starts the agent's own loop once per server process (Node runtime only). Set AGENT_WORKER=off on
// serverless hosts and drive /api/cron from a scheduler instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AGENT_WORKER === "off") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startWorker } = await import("./lib/agent/worker");
  startWorker();
}
