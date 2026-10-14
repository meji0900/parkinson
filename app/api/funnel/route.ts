export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ok } from "@/lib/server/api";
import { funnel } from "@/lib/views";

export const GET = () => ok({ at: new Date().toISOString(), ...funnel() });
