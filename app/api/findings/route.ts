export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ok } from "@/lib/server/api";
import { findings } from "@/lib/views";

export const GET = () => ok(findings());
