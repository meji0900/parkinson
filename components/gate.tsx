"use client";
// The entry gate. Around the logo a spiral is drawn the way a patient draws one at the bedside, outward,
// with a 5 Hz tremor riding on the line. It lifts as soon as the agent's live feed answers, and only on
// the first page of a visit. A tiny inline script hides it before paint on later loads, and a CSS
// timeout lifts it even if scripts never run.
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";

const KEY = "parkinson-gate-seen";
const INK = "#141b26", PEN = "#8b5a2b";
const EARLY = `try{if(sessionStorage.getItem("${KEY}")==="1")document.documentElement.dataset.gate="seen"}catch(e){}`;

export function Gate() {
  const canvas = useRef<HTMLCanvasElement>(null);
  // decided once per mount, so a second run of the effect (React's development double-invoke) sees the same answer
  const seenBefore = useRef<boolean | null>(null);
  const [gone, setGone] = useState(false);
  const [skip, setSkip] = useState(false);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (seenBefore.current === null) {
      try { seenBefore.current = sessionStorage.getItem(KEY) === "1"; sessionStorage.setItem(KEY, "1"); } catch { seenBefore.current = false; }
    }
    if (seenBefore.current) { setSkip(true); return; }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = canvas.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = 168;
    c.width = S * dpr; c.height = S * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    // the spiral starts just outside the round portrait (radius 42) and coils out to the edge of the canvas
    const DRAW = 1300, TURNS = 1.7, R0 = 47, R1 = 77, N = 320;
    let raf = 0, t0 = 0, connected = false, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setGone(true);
      setTimeout(() => { document.documentElement.dataset.gate = "seen"; }, 800);
    };
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const el = now - t0;
      const u = reduced ? 1 : Math.min(1, el / DRAW);
      ctx.clearRect(0, 0, S, S);
      ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = INK;
      ctx.beginPath();
      const steps = Math.max(2, Math.floor(N * u));
      let x = S / 2, y = S / 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / N;
        const th = t * TURNS * 2 * Math.PI;
        // a 5 Hz tremor over the seconds a patient takes to draw it: about forty cycles along the line, the
        // wobble growing as the hand travels out (the animation itself runs faster than the hand)
        const r = R0 + (R1 - R0) * t + 3.2 * t * Math.sin(2 * Math.PI * 40 * t);
        x = S / 2 + r * Math.cos(th); y = S / 2 + r * Math.sin(th);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = PEN;
      ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill();
      if ((u >= 1 && connected) || el > 3000) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ctl = new AbortController();
    setStatus("connecting to the agent");
    fetch("/api/live?after=0", { signal: ctl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d: { status?: { gene?: string; last?: string } }) => {
        const s = d.status;
        setStatus(s?.gene ? `live: working on ${s.gene}` : s?.last ? `live: last read ${s.last}` : "live");
        setTimeout(() => { connected = true; }, 250);
      })
      .catch(() => { setStatus("offline; showing the records"); connected = true; });
    return () => { cancelAnimationFrame(raf); ctl.abort(); };
  }, []);

  if (skip) return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY }} />
      <div className={`gate${gone ? " gone" : ""}`} aria-hidden={gone} role="status" aria-label="Loading">
        <div className="gate-art">
          <canvas ref={canvas} width={168} height={168} aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element -- a 256 px webp; next/image adds nothing here */}
          <img className="gate-mark" src="/brand/portrait.webp" width={84} height={84} alt="" />
        </div>
        <p className="gate-name">{BRAND.name}</p>
        <p className="gate-status" aria-live="polite">{status}</p>
      </div>
    </>
  );
}
