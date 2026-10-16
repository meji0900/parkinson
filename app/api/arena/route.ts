export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { POINTS, standings } from "@/lib/arena";
import { ok } from "@/lib/server/api";

export const GET = () => ok({ points: POINTS, ...standings() });
