// The mark: an Archimedes spiral, the drawing a movement-disorder clinic asks for at the bedside. The line
// carries a small regular wobble, the way a tremor writes itself into the spiral; the brown dot is the pen.
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

const toPath = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L");
const PTS = spiralPoints();
const PATH = toPath(PTS);
const [EX, EY] = PTS[PTS.length - 1];

export function Mark({ size = 26, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden={title ? undefined : true} role={title ? "img" : undefined} fill="none">
      {title && <title>{title}</title>}
      <path d={PATH} stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={EX} cy={EY} r="2.1" fill="#8b5a2b" />
    </svg>
  );
}
