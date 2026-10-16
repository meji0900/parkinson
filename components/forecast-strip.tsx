// One closed forecast window on a line from "won't hold" (0%) to "holds" (100%): every forecast as a tick, the crowd's
// average, the agent's sealed number, and the end it actually landed on, marked by a pigmented neuron (held) or a
// pale, depigmented one (did not). Pure SVG, so the server and the forecast board can both draw it.
type Mark = { p: number; kind: "person" | "agent" };

const X0 = 14, X1 = 346, W = 360, Y = 22;
const x = (p: number) => X0 + p * (X1 - X0);

export function ForecastStrip({ held, house, crowd, marks, mine }: { held: boolean; house: number; crowd: number | null; marks: Mark[]; mine?: number | null }) {
  return (
    <svg className="fstrip" viewBox={`0 0 ${W} 44`} role="img" aria-label={`agent ${Math.round(house * 100)}%${crowd != null ? `, crowd ${Math.round(crowd * 100)}%` : ""}${mine != null ? `, you ${Math.round(mine * 100)}%` : ""}; it ${held ? "held" : "did not hold"}`}>
      <line className="axis" x1={X0} x2={X1} y1={Y} y2={Y} />
      {[0, 0.5, 1].map((t) => <line key={t} className="tick" x1={x(t)} x2={x(t)} y1={Y - 4} y2={Y + 4} />)}
      {/* the end it landed on */}
      <g transform={`translate(${held ? X1 : X0} ${Y})`} className={held ? "end held" : "end failed"}>
        <ellipse rx="7.5" ry="5.6" />
        {held ? <><circle className="melanin" cx="2.2" cy="-1.4" r="2.1" /><circle className="melanin" cx="0.4" cy="2.2" r="1.7" /><circle className="nucleus" cx="-3.1" r="1.9" /></> : <circle className="glia" cx="-0.6" cy="0.4" r="1.6" />}
      </g>
      {marks.map((m, i) => <line key={i} className={`f ${m.kind}`} x1={x(m.p)} x2={x(m.p)} y1={Y - 9} y2={Y + 9} />)}
      {crowd != null && <path className="crowd" d={`M${x(crowd)} ${Y - 7} l6 7 l-6 7 l-6 -7 z`} />}
      <circle className="house" cx={x(house)} cy={Y} r="5" />
      {mine != null && <circle className="mine" cx={x(mine)} cy={Y} r="9" />}
      <text x={X0} y="42" className="lbl">0%</text>
      <text x={x(0.5)} y="42" className="lbl" textAnchor="middle">50%</text>
      <text x={X1} y="42" className="lbl" textAnchor="end">100%</text>
    </svg>
  );
}

export function StripLegend() {
  return (
    <p className="fstrip-key small">
      <span><svg viewBox="0 0 12 12" aria-hidden><circle className="house" cx="6" cy="6" r="4.5" /></svg> james, sealed</span>
      <span><svg viewBox="0 0 12 12" aria-hidden><path className="crowd" d="M6 0.5 l5.5 5.5 l-5.5 5.5 l-5.5 -5.5 z" /></svg> the crowd&apos;s average</span>
      <span><svg viewBox="0 0 12 12" aria-hidden><line className="f person" x1="6" x2="6" y1="1" y2="11" /></svg> a person</span>
      <span><svg viewBox="0 0 12 12" aria-hidden><line className="f agent" x1="6" x2="6" y1="1" y2="11" /></svg> an agent</span>
      <span><svg viewBox="0 0 16 12" aria-hidden><ellipse className="end-held" cx="8" cy="6" rx="6.5" ry="4.8" /></svg> it held</span>
    </p>
  );
}
