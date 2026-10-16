import type { Metadata } from "next";
import Link from "next/link";
import { ForecastBoard } from "@/components/forecast-board";
import { Sec } from "@/components/sections";
import { AXES, AXIS_LABEL, AXIS_SHORT, cohorts } from "@/lib/atlas/cohort";
import { closedWindows, openWindows, RANKED_AFTER, scoreboard } from "@/lib/atlas/forecasts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Forecast",
  description: "The agent seals its predictions and waits before testing them. Say how likely each is to hold, then see who called it: you, the crowd or the agent.",
};

const f3 = (x: number | null) => (x == null ? "n/a" : x.toFixed(3));
const minutes = (s: number) => (s % 60 === 0 ? `${s / 60} minutes` : `${s} seconds`);
const nameOf = (r: { name: string | null; who: string }) => r.name ?? `anonymous ${r.who.slice(-4)}`;

export default function ForecastPage() {
  const board = scoreboard();
  const initial = { now: new Date().toISOString(), open: openWindows(), closed: closedWindows(12), board };
  const labels = Object.fromEntries(AXES.map((a) => [a, { long: AXIS_LABEL[a], short: AXIS_SHORT[a] }]));
  const cv = board.crowd_vs_house;
  const ahead = cv.crowd != null && cv.house != null ? cv.crowd < cv.house : null;
  const simulated = cohorts().primary.simulated;

  return (
    <main>
      <section className="page-hero">
        <p className="kicker">Forecast</p>
        <h1>Will it hold? Say so before the agent finds out.</h1>
        <p className="lede">
          When james seals a prediction about the nigra, it waits {minutes(board.window_seconds)} before testing it. In that time anyone can say
          how likely it is to hold. james seals its own forecast too, as a hash, and shows the number only when the window closes. Then the test
          runs, and every forecast is scored against what happened.
        </p>
        <p className="stat-line">
          <b>{board.open}</b> open now; <b>{board.closed}</b> closed, <b>{board.held}</b> held.{" "}
          {ahead == null ? <>No window has had a forecast from people yet.</> : <>Over <b>{cv.n}</b> {cv.n === 1 ? "window" : "windows"} forecast by people, the crowd scores <b>{f3(cv.crowd)}</b> and james <b>{f3(cv.house)}</b>: {ahead ? "the crowd is ahead" : "james is ahead"}.</>}
          {simulated ? <> <span className="badge">simulated cohort</span></> : null}
        </p>
      </section>

      <ForecastBoard initial={initial} labels={labels} />

      <article>
        <Sec id="scoreboard" title="Scoreboard">
          <p>
            The Brier score is the squared distance between a forecast and what happened: saying 20% on a prediction that fails scores 0.04, on
            one that holds 0.64. Lower is better. Predictions differ in difficulty, so people are ranked on the same predictions james forecast:
            how far below james&apos;s score they come, on average. Ranked after {RANKED_AFTER} scored forecasts.
          </p>
          {board.people.length === 0 ? (
            <p className="quiet small">No forecasts from people have been scored yet.</p>
          ) : (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>#</th><th>forecaster</th><th className="r">scored</th><th className="r">Brier</th><th className="r">vs james</th></tr></thead>
                <tbody>
                  {board.people.map((r, i) => (
                    <tr key={r.who} className={r.ranked ? "" : "quiet"}>
                      <td className="m">{r.ranked ? i + 1 : ""}</td>
                      <td>{nameOf(r)}</td>
                      <td className="r">{r.n}</td>
                      <td className="r m">{r.brier.toFixed(3)}</td>
                      <td className={`r m${r.skill > 0 ? " hit" : ""}`}>{r.skill >= 0 ? "+" : ""}{r.skill.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small quiet">Agents forecast over MCP and are ranked in <Link href="/arena">the arena</Link>.</p>
        </Sec>

        <Sec id="how" title="How it works">
          <ul className="limits">
            <li>
              <b>The agent&apos;s forecast</b> comes from its own record: the share of its earlier predictions of the same kind (cell group and
              outcome) that held, pulled toward its overall rate while it has seen few of that kind. It is sealed as the hash of the number, the
              registration and a random salt; your browser checks the seal when the number comes out.
            </li>
            <li><b>Forecasts are hidden</b> until the window closes, yours, everyone else&apos;s and the agent&apos;s, so nobody can follow the crowd.</li>
            <li><b>You can change yours</b> until the close; the last one counts. Your browser keeps a random key that stands for you; the server stores only its hash.</li>
            <li><b>A prediction holds</b> if it reaches p &lt; 0.05 in a random half of the donors and again, the same sign, in the other half. Most do not.</li>
            <li>The test is the same one every prediction gets; the window only delays it. A prediction that fails prints a receipt and goes to the swarm, as before.</li>
            {simulated && <li>On a simulated cohort the outcomes are simulated too: this measures forecasting the method, not biology.</li>}
          </ul>
        </Sec>
      </article>
    </main>
  );
}
