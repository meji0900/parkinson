import { createHash } from "node:crypto";
import { canon } from "@/lib/canon";

export const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
export const hashOf = (v: unknown) => sha256(canon(v));
