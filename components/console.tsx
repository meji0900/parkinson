"use client";
// The slide: the agent's console. It follows the live feed until a visitor types a gene (streamed from
// /api/run) or a question (/api/ask), then catches up on what it missed. The frosted end of the slide
// carries the label a histologist would write on it: the gene on the bench and the region.
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { Terminal, type Ev } from "@/lib/client/terminal";
import { useLive, type LiveEvent } from "./live";
import { Mark } from "./mark";
import { Proposal, type Hyp } from "./proposal";

const NOT_GENES = /^(hi|hey|hello|why|what|who|how|status|help|receipts?|swarm|gm|wen|ser)$/i;

export function Console({ examples, region = "substantia nigra" }: { examples: string[]; region?: string }) {
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
  // the proposal keeps the gene it was written for, whatever the slide shows next
  const [hyp, setHyp] = useState<{ hyp: Hyp; gene: string } | null>(null);
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
      onHypothesis: (h, g) => setHyp({ hyp: h as Hyp, gene: g ?? "" }),
      onReceipt: () => window.dispatchEvent(new Event("parkinson:receipts")),
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
      // a gene sent here from another page (?gene=LRRK2#live) starts as soon as the console is up
      const asked = new URLSearchParams(window.location.search).get("gene");
      if (asked) {
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
        investigate(asked);
      }
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
    window.addEventListener("parkinson:investigate", onAsk);
    return () => {
      // React mounts effects twice in development: stop the first boot before the second starts
      alive = false;
      term.run++;
      following.current = false;
      lastSeq.current = 0;
      off();
      window.removeEventListener("parkinson:investigate", onAsk);
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
    <div className="console">
      <div className="slide">
        <div className="slide-label" aria-hidden>
          <span>{BRAND.name}</span>
          <span className="gene">{gene}</span>
          <span>{region}</span>
          <span className="mode">{mode}</span>
        </div>
        <div className="slide-glass">
          <div className="room-bar"><span><Mark size={18} /> the agent, live</span><span>{mode}</span></div>
          <div className="room-body" ref={termRef} role="log" aria-live="off" aria-label="Agent console" tabIndex={0} />
          <form className="room-in" onSubmit={submit} autoComplete="off">
            <label htmlFor="gene-input" className="prompt">$</label>
            <input id="gene-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="a gene (LRRK2) or ask: what are you doing?" spellCheck={false} maxLength={300} aria-label="Gene symbol or question" />
            <button type="submit">run</button>
          </form>
        </div>
      </div>
      <p className="try">
        <span>examples:</span>
        {examples.map((g) => (
          <button key={g} type="button" onClick={() => investigate(g)}>{g}</button>
        ))}
      </p>
      {hyp && <Proposal hyp={hyp.hyp} gene={hyp.gene || gene} />}
    </div>
  );
}
