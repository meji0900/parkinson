"use client";
// One poller for the whole page: the header status and the console both read the agent's live feed.
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type LiveEvent = { seq: number; ts: string; gene: string | null; k: string; fac?: string; x: string; [extra: string]: unknown };
export type LiveStatus = {
  at: string; state: string; gene?: string; last?: string; next_at?: string; interval: number; queue?: number; worker?: boolean; note?: string;
};

type Ctx = { status: LiveStatus | null; last: LiveEvent | null; subscribe: (fn: (events: LiveEvent[]) => void) => () => void; backlog: () => LiveEvent[] };
const LiveCtx = createContext<Ctx | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [last, setLast] = useState<LiveEvent | null>(null);
  const subs = useRef(new Set<(e: LiveEvent[]) => void>());
  const seen = useRef<LiveEvent[]>([]);
  const after = useRef(0);

  useEffect(() => {
    let timer = 0, stopped = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/live?after=${after.current}`, { cache: "no-store" });
        const d = (await r.json()) as { status: LiveStatus; events: LiveEvent[] };
        setStatus(d.status);
        if (d.events.length) {
          // the neuron field fires a cell for each new step the agent takes (not for the backlog on first load)
          if (after.current > 0) {
            window.dispatchEvent(new Event("james:pulse"));
          }
          after.current = d.events[d.events.length - 1].seq;
          setLast(d.events[d.events.length - 1]);
          seen.current = [...seen.current, ...d.events].slice(-80);
          subs.current.forEach((fn) => fn(d.events));
        }
      } catch {
        /* the next poll tries again */
      }
      if (!stopped) timer = window.setTimeout(poll, document.hidden ? 15000 : 2500);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);

  const value: Ctx = {
    status,
    last,
    subscribe: (fn) => { subs.current.add(fn); return () => { subs.current.delete(fn); }; },
    backlog: () => seen.current.slice(-40),
  };
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive() {
  const c = useContext(LiveCtx);
  if (!c) throw new Error("useLive outside LiveProvider");
  return c;
}

const SOURCE: Record<string, string> = {
  genetics: "Open Targets", cell: "the Protein Atlas", chem: "Open Targets", clinic: "ClinicalTrials.gov", lit: "PubMed", path: "Reactome",
};
function step(e: LiveEvent | null) {
  if (!e) return "";
  switch (e.k) {
    case "open": return `reading ${SOURCE[e.fac ?? ""] ?? e.fac}`;
    case "find": return `read ${SOURCE[e.fac ?? ""] ?? e.fac}`;
    case "merge": return "combining six findings";
    case "speak": case "done": return "writing the proposal";
    case "atlas": case "register": return "sealing predictions";
    case "test": return "testing on the atlas";
    case "receipt": return "printed a receipt";
    case "pass": return "a prediction held";
    case "swarm": return e.fac && e.fac !== "swarm" ? `${e.fac} analyst` : "swarm";
    case "study": return "running a sealed study";
    default: return "";
  }
}
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function describe(status: LiveStatus | null, last: LiveEvent | null, now: number): { text: string; on: boolean } {
  if (!status) return { text: "connecting", on: false };
  if (now - Date.parse(status.at) > 12 * 60_000 && status.state !== "idle") return { text: "paused", on: false };
  const s = step(last && last.gene === status.gene ? last : null);
  switch (status.state) {
    case "working": case "testing": return { text: `working on ${status.gene}${s ? `, ${s}` : ""}`, on: true };
    case "swarm": return { text: `swarm on ${status.gene}${s ? `, ${s}` : ""}`, on: true };
    case "waiting": return { text: status.last ? `finished ${status.last}; next gene in ${clock(Date.parse(status.next_at ?? "") - now)}` : "starting", on: true };
    case "idle": return { text: "queue done; nightly run at 02:30 UTC", on: false };
    default: return { text: "starting", on: true };
  }
}

export function LivePulse() {
  const { status, last } = useLive();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const d = describe(status, last, now);
  return (
    <Link className={`live${d.on ? "" : " off"}`} href="/#live" aria-live="polite">
      <i aria-hidden />
      <span>{d.on ? <b>live </b> : null}{d.text}</span>
    </Link>
  );
}
