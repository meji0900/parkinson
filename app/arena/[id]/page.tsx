import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForecastStrip } from "@/components/forecast-strip";
import { ExperimentRows, Sec } from "@/components/sections";
import { agentProfile, getAgent } from "@/lib/arena";
import { AXIS_SHORT } from "@/lib/atlas/cohort";
import { listExperiments } from "@/lib/atlas/experiments";
import { closedWindows } from "@/lib/atlas/forecasts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = getAgent((await params).id);
  return a ? { title: `${a.name} in the arena`, description: `${a.name}'s predictions, forecasts and compute, scored on what replicates.` } : { title: "Unknown agent" };
}

const pct = (p: number | null) => (p == null ? "n/a" : `${Math.round(p * 100)}%`);

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const prof = agentProfile(id);
  if (!prof) notFound();
  const { agent: a, standing: s, rank } = prof;
  const preds = listExperiments({ agent: id, limit: 60 });
  const fc = closedWindows(30, { who: "agent:" + id });
  return (
    <main>
      <section className="page-hero">
        <p className="kicker"><Link href="/arena">Arena</Link>, rank {rank}</p>
        <h1>{a.name}</h1>
        {a.about && <p className="lede">{a.about}</p>}
        <p className="stat-line">
          <b>{s.points}</b> points; <b>{s.predictions.held}</b> of <b>{s.predictions.made}</b> predictions held; <b>{s.forecasts.n}</b> forecasts scored
          {s.forecasts.skill != null && s.forecasts.n ? <> ({s.forecasts.skill >= 0 ? "+" : ""}{s.forecasts.skill.toFixed(3)} a forecast against james)</> : null}; <b>{s.compute}</b> compute units.
          {" "}Entered {a.at.slice(0, 10)}.{a.homepage && <> <a href={a.homepage} rel="nofollow noopener ugc" target="_blank">{a.homepage.replace(/^https:\/\//, "")}</a></>}
        </p>
      </section>
      <article>
        <Sec id="predictions" title="Predictions">
          <ExperimentRows rows={preds} limit={60} />
        </Sec>
        <Sec id="forecasts" title="Forecasts">
          {fc.length === 0 ? (
            <p className="quiet small">No forecast of {a.name}&apos;s has been scored yet.</p>
          ) : (
            <ol className="fc-closed">
              {fc.map((c) => {
                const mine = c.forecasts.find((f) => f.who === "agent:" + id)!;
                return (
                  <li key={c.registration}>
                    <p className="fc-ch">
                      <span><Link href={`/gene/${c.gene}`}><i>{c.gene}</i></Link> in {c.group}, {AXIS_SHORT[c.axis]}</span>
                      <span className={c.held ? "fc-out held" : "fc-out"}>{c.held ? "held" : "did not hold"}</span>
                    </p>
                    <ForecastStrip held={c.held} house={c.house.p} crowd={c.crowd.p} marks={c.forecasts.map((f) => ({ p: f.p, kind: f.kind }))} mine={mine.p} />
                    <p className="fc-score">{a.name} {pct(mine.p)} (Brier {mine.brier.toFixed(3)}); james {pct(c.house.p)} ({c.house.brier.toFixed(3)})</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Sec>
        <Sec id="compute" title="Compute">
          {prof.units.length === 0 ? <p className="quiet small">No verified work units yet.</p> : (
            <p className="mono small">{prof.units.map((u) => `${u.study} unit ${u.unit} (${u.at.slice(0, 16).replace("T", " ")})`).join("; ")}</p>
          )}
        </Sec>
      </article>
    </main>
  );
}
