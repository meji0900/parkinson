// Canonical JSON: sorted keys, no spaces, non-ASCII escaped. The server hashes receipts with it and
// the browser recomputes the same bytes to check the chain, so both sides import this one function.
const BACKSLASH = String.fromCharCode(92);
const NON_ASCII = new RegExp("[" + String.fromCharCode(0x7f) + "-" + String.fromCharCode(0xffff) + "]", "g");
const escapeChar = (c: string) => BACKSLASH + "u" + c.charCodeAt(0).toString(16).padStart(4, "0");

export function canon(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (
      "{" +
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => canon(k) + ":" + canon(o[k]))
        .join(",") +
      "}"
    );
  }
  return (JSON.stringify(v ?? null) ?? "null").replace(NON_ASCII, escapeChar);
}
