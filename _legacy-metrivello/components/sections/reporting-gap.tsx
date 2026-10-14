import clsx from "clsx";
import { reportingGap as r } from "@/lib/content";
import { LayersIcon } from "../ui/icons";
import { PaleSky } from "../ui/pale-sky";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

const reportTone = { blue: "bg-[#e8f5fd]", peach: "bg-[#fff1e3]" };
const barTone = { orange: "bg-[#f1a36b]", green: "bg-[#18a165]" };

export function ReportingGap() {
  return (
    <section id="reporting" className="section-pad bg-white">
      <div className="mx-auto flex max-w-[1600px] justify-center">
        <div className="relative flex w-full max-w-[1200px] flex-col items-center gap-4 overflow-hidden rounded-[24px] bg-[#edf6fc] p-4 md:gap-8 md:rounded-[32px] md:p-10 lg:flex-row lg:items-start lg:gap-10">
          <PaleSky />

          <Reveal y={24} className="relative z-[1] w-full md:max-w-[544px] lg:max-w-none lg:flex-1">
            <div className="flex flex-col gap-6 rounded-[24px] bg-white p-9">
              <SectionHeading align="left" eyebrow={r.eyebrow} heading={r.heading} description={r.description} />
              <p className="text-small text-[#7b897f]">{r.support}</p>
            </div>
          </Reveal>

          <Reveal y={24} className="relative z-[1] w-full md:max-w-[544px] lg:w-[480px] lg:shrink-0">
            <div className="flex flex-col gap-[18px] rounded-[24px] bg-[linear-gradient(135deg,rgba(255,255,255,0.72)_0%,#eff6f6_100%)] p-4 md:p-6">
              <div className="flex items-center gap-3">
                {r.reports.map((report, i) => (
                  <Reveal key={report.label} delay={0.1 * i} className="min-w-0 flex-1">
                    <div className={clsx("flex flex-col gap-2 rounded-xl p-3.5 shadow-[inset_0_0_0_1px_#fff]", reportTone[report.tone])}>
                      <p className="text-micro text-[#666]">{report.label}</p>
                      <p className="text-h3 text-ink">{report.value}</p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <div className="flex flex-col gap-3.5 rounded-2xl bg-white p-[22px] shadow-[0_8px_18px_rgba(33,70,54,0.07)]">
                <p className="text-button text-ink">{r.panel.label}</p>
                <p className="text-h2 text-ink">{r.panel.value}</p>
                <p className="text-small text-[#7a8b80]">{r.panel.description}</p>
                <div className="flex h-[125px] items-end gap-3.5" aria-hidden="true">
                  {r.panel.bars.map((bar, i) => (
                    <div key={i} className={clsx("min-w-0 flex-1 rounded-t-[5px]", barTone[bar.tone])} style={{ height: bar.h }} />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {r.sources.map((source) => (
                  <span key={source} className="rounded-3xl bg-white/80 px-[11px] py-[7px] text-micro text-[#666]">
                    {source}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-[#fff5e6] px-4 py-3 text-[#866031]">
                <LayersIcon size={18} className="shrink-0" />
                <p className="text-small">{r.warning}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
