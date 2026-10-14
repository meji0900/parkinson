"use client";
// The slide: the agent's console. It follows the live feed until a visitor types a gene (streamed from
// /api/run) or a question (/api/ask), then catches up on what it missed.
import { useEffect, useRef, useState } from "react";
import { Terminal, type Ev } from "@/lib/client/terminal";
import { useLive, type LiveEvent } from "./live";
import { Proposal, type Hyp } from "./proposal";

const NOT_GENES = /^(hi|hey|hello|why|what|who|how|status|help|receipts?|swarm|gm|wen|ser)$/i;

export function Console({ examples }: { examples: string[] }) {
  const termRef = useRef<HTMLDivElement>(null);
  const t = useRef<Terminal | null>(null);
  const following = useRef(false);
  const pending = useRef<LiveEvent[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const ctl = useRef<AbortController | null>(null);
  const lastSeq = useRef(0);
  // every live event is shown once, however it arrives (backlog, subscription, or catch-up)
  const fresh = (e: LiveEvent) => {
    if (e.seq <= lastSeq.current) return false;
    lastSeq.current = e.seq;
    return true;
  };
  const [gene, setGene] = useState("no gene yet");
  const [mode, setMode] = useState("connecting");
  const [hyp, setHyp] = useState<Hyp | null>(null);
  const [value, setValue] = useState("");
  const live = useLive();
  const statusRef = useRef(live.status);
  statusRef.current = live.status;
  const benchGene = () => {
    const st = statusRef.current;
    const g = st ? (st.state === "waiting" ? st.last : st.gene) : undefined;
    if (g && g !== "nightly run") setGene(g);
  };

  useEffect(() => {
    const term = new Terminal(termRef.current!, {
      onGene: setGene,
      onHypothesis: (h) => setHyp(h as Hyp),
      onReceipt: () => window.dispatchEvent(new Event("engram:receipts")),
    });
    t.current = term;
    termRef.current!.replaceChildren();
    let alive = true;
    const boot = async () => {
      const id = ++term.run;
      await term.banner(id);
      if (!alive) return;
      await term.say("live: following the agent as it works. type a gene, or ask me something.", id, "dim");
      if (!alive) return;
      for (const e of live.backlog()) if (alive && fresh(e)) await term.renderInstant(e as Ev, id);
      for (const e of pending.current.splice(0)) if (alive && fresh(e)) await term.renderInstant(e as Ev, id);
      if (!alive) return;
      following.current = true;
      setMode("live");
      benchGene();
    };
    boot();
    const off = live.subscribe((events) => {
      if (!following.current) { pending.current = [...pending.current, ...events].slice(-30); return; }
      for (const e of events) {
        queue.current = queue.current.then(() => {
          if (!following.current) { pending.current.push(e); return; }
          if (fresh(e)) return term.render(e as Ev, term.run);
        });
      }
    });
    const onAsk = (ev: Event) => investigate((ev as CustomEvent<string>).detail);
    window.addEventListener("engram:investigate", onAsk);
    return () => {
      // React mounts effects twice in development: stop the first boot before the second starts
      alive = false;
      term.run++;
      following.current = false;
      lastSeq.current = 0;
      off();
      window.removeEventListener("engram:investigate", onAsk);
      ctl.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // while following, the slide label shows what the agent itself has on the bench
  useEffect(() => {
    if (following.current) benchGene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.status]);

  async function resume(id: number) {
    const term = t.current!;
    const missed = pending.current.splice(0).filter(fresh);
    if (missed.length) await term.say("while you had me, i kept working:", id, "dim");
    for (const e of missed) await term.renderInstant(e as Ev, id);
    following.current = true;
    setMode("live");
    benchGene();
  }

  async function investigate(raw: string) {
    const g = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
    const term = t.current;
    if (!g || !term) return;
    const id = ++term.run;
    following.current = false;
    ctl.current?.abort();
    ctl.current = new AbortController();
    setMode(`working on ${g}`);
    setGene(g);
    setHyp(null);
    termRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await term.line("", id);
    try {
      const res = await fetch(`/api/run?gene=${encodeURIComponent(g)}`, { signal: ctl.current.signal });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({ error: "no answer" }));
        await term.say(d.error ?? "that run did not start.", id, "dim");
      } else {
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = "", chain: Promise<unknown> = Promise.resolve();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, i); buf = buf.slice(i + 1);
            if (!raw.trim()) continue;
            const e = JSON.parse(raw) as Ev;
            chain = chain.then(() => (id === term.run ? term.render(e, id) : undefined));
          }
        }
        await chain;
      }
      if (id === term.run) {
        await term.say("back to the live feed.", id, "dim");
        await resume(id);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") { await term.say("connection dropped. try again.", id, "dim"); await resume(id); }
    }
  }

  async function chat(q: string) {
    const term = t.current!;
    const id = ++term.run;
    following.current = false;
    setMode("answering");
    await term.type([["you> ", "dim"], [q, "hi"]], id, 0);
    try {
      const d = (await (await fetch(`/api/ask?q=${encodeURIComponent(q)}`)).json()) as { lines?: string[]; error?: string };
      for (const l of d.lines ?? [d.error ?? "no answer."]) await term.say(l, id);
    } catch {
      await term.say("connection dropped. try again.", id, "dim");
    }
    if (id === term.run) { await term.line("", id); await resume(id); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    setValue("");
    if (!v) return;
    if (/^[A-Za-z][A-Za-z0-9-]{1,15}$/.test(v) && !NOT_GENES.test(v)) investigate(v);
    else chat(v);
  }

  return (
    <div className="slide-wrap" id="live">
      <div className="slide">
        <div className="frost" aria-hidden>
          <span>engram</span>
          <span className="gene">{gene}</span>
          <span>temporal cortex</span>
          <span className="mode">{mode}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="term-head"><span>the agent, live</span><span>{mode}</span></div>
          <div className="term" ref={termRef} role="log" aria-live="off" aria-label="Agent console" tabIndex={0} />
          <form className="ask" onSubmit={submit}>
            <label htmlFor="gene-input" className="sr-only">Gene symbol or question</label>
            <input id="gene-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="type a gene (TREM2) or ask a question" autoComplete="off" spellCheck={false} maxLength={300} />
            <button type="submit">run</button>
          </form>
        </div>
      </div>
      <div className="chips">
        <span>Try</span>
        {examples.map((g) => (
          <button key={g} type="button" className="chip" onClick={() => investigate(g)}>{g}</button>
        ))}
      </div>
      {hyp && <Proposal hyp={hyp} gene={gene} />}
    </div>
  );
}
