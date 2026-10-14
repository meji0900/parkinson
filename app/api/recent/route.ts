export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { recentRuns } from "@/lib/agent/pipeline";
import { ok } from "@/lib/server/api";

export const GET = () => ok(recentRuns(30));
