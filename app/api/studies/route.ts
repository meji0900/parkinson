export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { listStudies, STUDIES } from "@/lib/atlas/studies";
import { ok } from "@/lib/server/api";

export const GET = () => ok({ queued: STUDIES.map((s) => s.id), studies: listStudies() });
