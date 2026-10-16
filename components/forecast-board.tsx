"use client";
// The forecast board: the agent's sealed predictions that are still open, each with a dial, and the ones that closed
// lately with how everyone did. A visitor is a random token kept in this browser; the server only ever sees its hash.
// The agent's revealed forecasts are checked against their seals here, in the browser.
import Link from "next/link";
import { useEffect, useState } from "react";
import { canon } from "@/lib/canon";
import type { ClosedWindow, OpenWindow } from "@/lib/atlas/forecasts";
import { ForecastStrip, StripLegend } from "./forecast-strip";
import { CellStrip } from "./sections";

type Row = { who: string; name: string | null; n: number; brier: number; skill: number; ranked: boolean };
export type BoardData = {
  now: string;
  open: OpenWindow[];
  closed: ClosedWindow[];
  board: { window_seconds: number; people: Row[]; crowd_vs_house: { n: number; crowd: number | null; house: number | null } };
};
type Labels = Record<string, { long: string; short: string }>;
type Me = { token: string; name: string; who: string | null; mine: Record<string, number> };

const K = { token: "james-forecaster", name: "james-forecaster-name", who: "james-forecaster-who", mine: "james-forecasts" };
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: forget on reload */ } };
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
const pct = (p: number | null | undefined) => (p == null ? "n/a" : `${Math.round(p * 100)}%`);
const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

async function sealOk(c: ClosedWindow) {
  const bytes = new TextEncoder().encode(canon({ p: c.house.p, registration: c.registration, salt: c.house.salt }));
  const hex = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  return hex === c.house.commit;
}

export function ForecastBoard({ initial, labels }: { initial: BoardData; labels: Labels }) {
  const [data, setData] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [clock, setClock] = useState(() => Date.parse(initial.now));
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [seals, setSeals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let t = read(K.token) ?? "";
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) { t = token(); store(K.token, t); }
    let mine: Record<string, number> = {};
    try { mine = JSON.parse(read(K.mine) ?? "{}"); } catch { /* start fresh */ }
    setMe({ token: t, name: read(K.name) ?? "", who: read(K.who), mine });
    setSkew(Date.parse(initial.now) - Date.now());
  }, [initial.now]);

  useEffect(() => {
    const tick = setInterval(() => setClock(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch("/api/forecasts", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as BoardData;
        setData(d);
        setSkew(Date.parse(d.now) - Date.now());
      } catch { /* try again on the next tick */ }
    }, 15000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  useEffect(() => {
    for (const c of data.closed) {
      if (seals[c.registration] !== undefined) continue;
      sealOk(c).then((ok) => setSeals((s) => ({ ...s, [c.registration]: ok })));
    }
  }, [data.closed, seals]);

  const now = clock + skew;
  const setName = (name: string) => { if (!me) return; store(K.name, name); setMe({ ...me, name }); };

  async function send(w: OpenWindow) {
    if (!me) return;
    const value = draft[w.registration] ?? me.mine[w.registration] ?? 50;
    setBusy(w.registration);
    try {
      const r = await fetch("/api/forecasts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: w.registration, p: value / 100, token: me.token, name: me.name }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setMsg((m) => ({ ...m, [w.registration]: { ok: false, text: d.error ?? "that did not go through" } })); return; }
      const mine = { ...me.mine, [w.registration]: Math.round(d.p * 100) };
      store(K.mine, JSON.stringify(mine));
      store(K.who, d.who);
      setMe({ ...me, mine, who: d.who });
      setData((x) => ({ ...x, open: x.open.map((o) => (o.registration === w.registration ? { ...o, forecasts: d.forecasts } : o)) }));
      setMsg((m) => ({ ...m, [w.registration]: { ok: true, text: `in: ${Math.round(d.p * 100)}%. You can move it until the window closes.` } }));
    } catch {
      setMsg((m) => ({ ...m, [w.registration]: { ok: false, text: "no connection; try again" } }));
    } finally {
      setBusy(null);
    }
  }

  const myRow = me?.who ? data.board.people.find((r) => r.who === me.who) : undefined;
  const mineIn = (c: ClosedWindow) => (me?.who ? c.forecasts.find((f) => f.who === me.who) : undefined);

  return (
    <>
      <section className="sec wide" id="open" data-rail="Open now" aria-labelledby="open-h">
        <h2 id="open-h">Open now</h2>
        {data.board.window_seconds <= 0 ? (
          <p className="quiet">The forecast window is switched off on this server; the agent tests its predictions as soon as it seals them.</p>
        ) : (
          <>
            <p>
              Each of these is sealed: the hash is public, the atlas has not been read. Say how likely you think it is to hold, meaning p &lt; 0.05 in one
              half of the donors and again, the same way, in the other. Forecasts stay hidden until the window closes, the agent&apos;s too.
            </p>
            <label className="fc-name">
              <span>your name on the scoreboard</span>
              <input value={me?.name ?? ""} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="optional" autoComplete="nickname" />
            </label>
            {data.open.length === 0 ? (
              <p className="quiet small">Nothing is open right now. The agent seals two new predictions every few minutes; this page checks every 15 seconds.</p>
            ) : (
              <ol className="fc-list">
                {data.open.map((w) => {
                  const left = Date.parse(w.closes) - now;
                  const closing = left <= 0;
                  const mine = me?.mine[w.registration];
                  const value = draft[w.registration] ?? mine ?? 50;
                  const m = msg[w.registration];
                  return (
                    <li key={w.registration} className={`fc-card${closing ? " closing" : ""}`}>
                      <div className="fc-head">
                        <Link href={`/gene/${encodeURIComponent(w.gene)}`} className="fc-gene">{w.gene}</Link>
                        <span className="fc-time" aria-live="off">{closing ? "closed; testing now" : `closes in ${mmss(left)}`}</span>
                      </div>
                      <p className="fc-claim">{w.gene} in {w.group} {labels[w.axis]?.long ?? w.axis}</p>
                      <p className="fc-meta">sealed {w.registration.slice(0, 12)}…; james&apos;s forecast sealed as {w.commit.slice(0, 10)}…; {w.forecasts} {w.forecasts === 1 ? "forecast" : "forecasts"} in</p>
                      <div className="fc-dial">
                        <label htmlFor={`d-${w.registration}`}>chance it holds</label>
                        <input
                          id={`d-${w.registration}`} type="range" min={0} max={100} step={1} value={value} disabled={closing}
                          onChange={(e) => setDraft((d) => ({ ...d, [w.registration]: Number(e.target.value) }))}
                          aria-valuetext={`${value} percent`}
                        />
                        <output htmlFor={`d-${w.registration}`}>{value}%</output>
                      </div>
                      <div className="fc-foot">
                        <CellStrip value={value / 100} />
                        <button type="button" className="btn sm" disabled={closing || busy === w.registration || !me} onClick={() => send(w)}>
                          {mine == null ? "Seal my forecast" : mine === value ? `Sealed at ${mine}%` : "Change it"}
                        </button>
                      </div>
                      {m && <p className={m.ok ? "fc-msg" : "fc-msg err"} role="status">{m.text}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </section>

      <section className="sec" id="closed" data-rail="Just closed" aria-labelledby="closed-h">
        <h2 id="closed-h">Just closed</h2>
        {myRow && (
          <p className="stat-line">
            You: <b>{myRow.n}</b> scored, Brier <b>{myRow.brier.toFixed(3)}</b>,{" "}
            {myRow.skill >= 0 ? <>ahead of james by <b>{myRow.skill.toFixed(3)}</b></> : <>behind james by <b>{(-myRow.skill).toFixed(3)}</b></>} a forecast.
          </p>
        )}
        <StripLegend />
        {data.closed.length === 0 ? (
          <p className="quiet small">No window has closed yet.</p>
        ) : (
          <ol className="fc-closed">
            {data.closed.map((c) => {
              const mine = mineIn(c);
              const seal = seals[c.registration];
              return (
                <li key={c.registration}>
                  <p className="fc-ch">
                    <span><Link href={`/gene/${encodeURIComponent(c.gene)}`}><i>{c.gene}</i></Link> in {c.group}, {labels[c.axis]?.short ?? c.axis}</span>
                    <span className={c.held ? "fc-out held" : "fc-out"}>
                      {c.held ? "held" : c.receipt ? <Link href={`/receipt/${c.receipt}`}>did not hold, receipt {String(c.receipt).padStart(4, "0")}</Link> : "did not hold"}
                    </span>
                  </p>
                  <ForecastStrip held={c.held} house={c.house.p} crowd={c.crowd.p} marks={c.forecasts.map((f) => ({ p: f.p, kind: f.kind }))} mine={mine?.p ?? null} />
                  <p className="fc-score">
                    james {pct(c.house.p)} (Brier {c.house.brier.toFixed(3)}
                    {seal === undefined ? ", checking the seal" : seal ? ", seal checks out" : ", SEAL DOES NOT MATCH"})
                    {c.crowd.p != null && <>; crowd of {c.crowd.n} {pct(c.crowd.p)} ({c.crowd.brier!.toFixed(3)})</>}
                    {mine && <>; you {pct(mine.p)} ({mine.brier.toFixed(3)})</>}
                    {!c.forecasts.length && <>; nobody else forecast it</>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
