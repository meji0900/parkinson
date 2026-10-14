export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ok } from "@/lib/server/api";
import { leaderboard } from "@/lib/views";

export const GET = () => ok({ rows: leaderboard() });
