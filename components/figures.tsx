// Illustrations drawn for this site, in the page's own inks. Each is labelled as a schematic: none is data.
import { spiralPoints } from "./mark";

const DAB = "#8b5a2b";

/** Braak's six stages as a matrix: rows are brain regions from the medulla up, columns are stages. */
export function BraakStages() {
  const rows = [
    "medulla, olfactory bulb",
    "pons: locus coeruleus, raphe",
    "midbrain: substantia nigra",
    "forebrain, temporal mesocortex",
    "high-order association cortex",
    "first-order association cortex",
  ];
  const L = 250, C = 50, R = 30, T = 30;
  const W = L + 6 * C + 8, H = T + 6 * R + 40;
  return (
    <figure className="plate wide">
      <svg className="illus" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="braak-t">
        <title id="braak-t">Braak staging of Lewy pathology: six stages, each adding brain regions from the medulla up to the neocortex.</title>
        {Array.from({ length: 6 }, (_, s) => (
          <text key={s} className="t ink" x={L + s * C + C / 2} y={18} textAnchor="middle">{s + 1}</text>
        ))}
        <rect x={L + 2 * C + 2} y={T - 4} width={2 * C - 4} height={6 * R + 8} fill="none" stroke={DAB} strokeDasharray="3 3" />
        {rows.map((label, i) => {
          const r = 5 - i; // the medulla sits at the bottom
          const y = T + r * R;
          return (
            <g key={label}>
              <text className="t" x={L - 12} y={y + R / 2 + 4} textAnchor="end">{label}</text>
              {Array.from({ length: 6 }, (_, s) => {
                const on = s >= i;
                const depth = on ? Math.min(1, 0.32 + (s - i) * 0.17) : 0;
                return <rect key={s} x={L + s * C + 3} y={y + 3} width={C - 6} height={R - 6} rx={3} fill={on ? DAB : "none"} fillOpacity={depth} stroke={on ? "none" : "#c9d1dc"} />;
              })}
            </g>
          );
        })}
        <text className="t" x={L + 3 * C} y={T + 6 * R + 22} textAnchor="middle">motor signs usually appear at stages 3 to 4</text>
      </svg>
      <figcaption>
        Braak&apos;s staging of Lewy pathology in sporadic Parkinson&apos;s: each stage adds regions, from the dorsal motor nucleus of the vagus
        in the medulla and the olfactory bulb, through the locus coeruleus and the substantia nigra, up to the neocortex. Schematic drawn for this page from Braak et al., <a href="https://doi.org/10.1016/S0197-4580(02)00065-9"><i>Neurobiology of Aging</i> 2003</a>; shading is
        illustrative, not data.
      </figcaption>
    </figure>
  );
}

/** A DaTscan sketch: the striatum's dopamine-transporter signal, normally two commas, in Parkinson's two full stops. */
export function DatScan() {
  const panel = (x: number, label: string, pd: boolean) => (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="0" width="260" height="210" rx="8" fill="#0d1219" />
      <ellipse cx="130" cy="108" rx="96" ry="84" fill="#141c27" stroke="#243042" />
      {[-1, 1].map((side) => {
        const put = pd ? (side < 0 ? 0.12 : 0.28) : 0.95;
        const cau = pd ? (side < 0 ? 0.72 : 0.9) : 1;
        return (
          <g key={side} transform={`translate(${130 + side * 34} 92) scale(${side} 1)`} filter="url(#dat-glow)">
            <ellipse cx="0" cy="0" rx="15" ry="17" fill="url(#dat-hot)" opacity={cau} />
            <ellipse cx="12" cy="30" rx="13" ry="27" transform="rotate(-24 12 30)" fill="url(#dat-hot)" opacity={put} />
          </g>
        );
      })}
      <text x="130" y="200" textAnchor="middle" fill="#9aa6b6" style={{ font: "400 11px var(--mono)" }}>{label}</text>
    </g>
  );
  return (
    <figure className="plate wide">
      <svg className="illus" viewBox="0 0 540 214" role="img" aria-labelledby="dat-t">
        <title id="dat-t">Schematic DaTscan images: a healthy striatum shows two comma shapes; in Parkinson&apos;s the putamen fades first, leaving two full stops.</title>
        <defs>
          <radialGradient id="dat-hot">
            <stop offset="0" stopColor="#fff4d6" />
            <stop offset="0.45" stopColor="#f2a541" />
            <stop offset="1" stopColor="#b5401d" stopOpacity="0.05" />
          </radialGradient>
          <filter id="dat-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" /></filter>
        </defs>
        {panel(0, "healthy: two commas", false)}
        {panel(280, "Parkinson's: full stops", true)}
      </svg>
      <figcaption>
        What a dopamine-transporter scan (DaTscan, ioflupane SPECT) looks for. Normal uptake in the striatum forms two commas, caudate as the head
        and putamen as the tail; in Parkinson&apos;s the putamen fades first, often on one side more. Schematic drawn for this page, not a patient&apos;s
        scan; the test cannot tell Parkinson&apos;s from the atypical parkinsonisms.
      </figcaption>
    </figure>
  );
}

const path = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");

/** Two Archimedes spirals: one steady, one carrying a regular tremor. */
export function SpiralTest() {
  const steady = spiralPoints({ turns: 4, r0: 4, r1: 92, wobble: 0, n: 700, cx: 110, cy: 110 });
  const tremor = spiralPoints({ turns: 4, r0: 4, r1: 92, wobble: 4.2, cycles: 23, n: 1400, cx: 110, cy: 110 });
  return (
    <figure className="plate wide">
      <svg className="illus" viewBox="0 0 470 236" role="img" aria-labelledby="spiral-t">
        <title id="spiral-t">Two Archimedes spirals: one drawn steadily, one with a regular tremor riding on the line.</title>
        <path d={path(steady)} fill="none" className="ink" strokeWidth="1.6" strokeLinecap="round" />
        <g transform="translate(250 0)">
          <path d={path(tremor)} fill="none" className="ink" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={tremor[tremor.length - 1][0]} cy={tremor[tremor.length - 1][1]} r="4" fill={DAB} />
        </g>
      </svg>
      <figcaption>
        The spiral test, a standard bedside drawing in movement-disorder clinics: a tremor writes itself into the line as a regular wobble, and
        in Parkinson&apos;s the spiral may also shrink as it goes. Generated for this page, not a patient&apos;s drawing. The same spiral is this
        site&apos;s mark.
      </figcaption>
    </figure>
  );
}
