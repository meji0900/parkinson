// The Archimedes spiral a movement-disorder clinic asks for at the bedside, with the small regular wobble a tremor writes
// into it. The figures and the entry gate draw it; it was the site's mark before the engraved profile below.
export function spiralPoints(opts: { turns?: number; r0?: number; r1?: number; wobble?: number; cycles?: number; n?: number; cx?: number; cy?: number } = {}) {
  const { turns = 3.1, r0 = 1.4, r1 = 12.6, wobble = 0.6, cycles = 7, n = 240, cx = 16, cy = 16 } = opts;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = t * turns * 2 * Math.PI;
    const r = r0 + (r1 - r0) * t + wobble * t * Math.sin(th * cycles);
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return pts;
}

/** the mark: the engraved profile from the logo, cropped round (an illustration, not a likeness of James Parkinson) */
export function Mark({ size = 26, title }: { size?: number; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 128 px webp; next/image adds nothing here
    <img className="mark" src="/brand/mark.webp" width={size} height={size} alt={title ?? ""} aria-hidden={title ? undefined : true} decoding="async" />
  );
}
