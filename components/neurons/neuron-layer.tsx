"use client";
// Mounts the nigral field behind the page. three.js loads after first paint, in its own chunk.
import { useEffect, useRef, useState } from "react";
import type { NeuronField } from "./field";

const KEY = "james-neurons-paused";

export function NeuronLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<NeuronField | null>(null);
  const [stage, setStage] = useState(1);
  const [pigmented, setPigmented] = useState(100);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stored = false;
    try { stored = localStorage.getItem(KEY) === "1"; } catch { /* storage blocked: start animated */ }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./field").then(({ NeuronField }) => {
      if (cancelled || !canvas.current) return;
      try {
        field.current = new NeuronField(canvas.current, { reduced: reduced || stored, onStage: (s, p) => { setStage(s); setPigmented(p); } });
        setPaused(stored || reduced);
      } catch {
        setFailed(true); // no WebGL: the page reads fine without the field
      }
    });
    return () => {
      cancelled = true;
      field.current?.dispose();
      field.current = null;
    };
  }, []);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    field.current?.setPaused(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* not remembered */ }
  };

  if (failed) return null;
  return (
    <>
      <canvas ref={canvas} className="neurons" aria-hidden="true" />
      <div className="neuro-hud">
        <span title="The tissue in the margins goes through Lewy pathology as you scroll, from Braak stage 1 to 6: Lewy bodies form, the pigment pales, and the vulnerable neurons are lost. An illustration, not data.">
          Braak stage <b>{stage}</b>, <b>{pigmented}%</b> of pigmented neurons left
        </span>
        <button type="button" onClick={toggle} aria-pressed={paused}>{paused ? "Animate" : "Pause"}</button>
      </div>
    </>
  );
}
