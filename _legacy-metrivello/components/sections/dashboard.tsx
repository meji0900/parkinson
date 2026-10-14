import clsx from "clsx";
import type { ComponentType } from "react";
import { dashboard as d } from "@/lib/content";
import { Logo } from "../ui/logo";
import { ChartBarIcon, ChartPieIcon, LayersIcon, SparklesIcon, TargetIcon } from "../ui/icons";

const sidebarIcons: Record<(typeof d.sidebar)[number], ComponentType<{ size?: number }>> = {
  Overview: ChartPieIcon,
  Channels: LayersIcon,
  "AI insights": SparklesIcon,
  Reports: ChartBarIcon,
  "Source health": TargetIcon,
};

type DashboardProps = {
  /** "hero" sits in the hero (frosted frame, open bottom); "showcase" is the framed copy in pricing. */
  variant: "hero" | "showcase";
  className?: string;
};

/** Illustrative "Marketing overview" product preview. */
export function Dashboard({ variant, className }: DashboardProps) {
  const hero = variant === "hero";
  return (
    <div
      className={clsx(
        "relative z-[1] w-full p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]",
        hero
          ? "rounded-t-[24px] bg-white/72 backdrop-blur-[2px]"
          : "rounded-[24px] bg-[#86c8a2]",
        className,
      )}
      aria-label="Illustrative product preview with sample data"
      role="img"
    >
      <div className={clsx("flex overflow-hidden bg-white", hero ? "rounded-t-2xl" : "rounded-2xl")}>
        {/* Sidebar (desktop only) */}
        <div className="hidden w-[170px] shrink-0 flex-col gap-[25px] bg-[#f7faf8] px-4 py-[22px] lg:flex">
          <div className="py-[3px]">
            <Logo width={112} />
          </div>
          <p className="text-micro text-[#687b70]">{d.workspace}</p>
          {d.sidebar.map((item, i) => {
            const Icon = sidebarIcons[item];
            return (
              <div
                key={item}
                className={clsx(
                  "flex items-center gap-2 rounded-lg p-2.5",
                  i === 0 ? "bg-[#e5f5e9] text-accent" : "text-[#66776c]",
                )}
              >
                <Icon size={14} />
                <span className="text-micro">{item}</span>
              </div>
            );
          })}
        </div>

        {/* Main overview */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-6 lg:p-[22px]">
          <div className="flex items-center gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="hidden text-h3 text-ink md:block">{d.title}</h3>
              <p className="text-[16px] leading-[1.2] text-black md:hidden">{d.compactTitle}</p>
              <p className="text-micro text-[#66776c]">{d.period}</p>
            </div>
            <SparklesIcon size={20} className="hidden shrink-0 text-[#16aa68] md:block" />
          </div>

          {/* Metric tiles: 2 compact (phone) · 2×2 (tablet) · 4 across (desktop) */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {d.metrics.map((m, i) => (
              <div
                key={m.label}
                className={clsx(
                  "flex-col rounded-2xl bg-white shadow-[inset_0_0_0_1px_#e1e9e4]",
                  "gap-3 px-3 py-4 md:gap-[9px] md:p-5",
                  i < 2 ? "flex" : "hidden md:flex",
                )}
              >
                <p className="text-small text-muted">{m.label}</p>
                <p className="text-[20px] leading-[1.2] font-semibold tracking-[-0.8px] text-ink md:hidden">
                  {m.compactValue}
                </p>
                <p className="hidden text-[30px] leading-[1.1] font-medium tracking-[-1px] text-[#666] md:block">{m.value}</p>
                <p className="text-micro text-accent md:hidden">{m.compactDelta}</p>
                <p className="hidden text-micro text-accent md:block">{m.delta}</p>
              </div>
            ))}
          </div>

          {/* Chart + AI signal */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="hidden min-w-0 flex-1 flex-col gap-4 rounded-2xl p-[18px] shadow-[inset_0_0_0_1px_#e1e9e4] md:flex">
              <p className="text-[16px] leading-[1.2] text-black">{d.chartTitle}</p>
              <div className="flex h-[132px] items-end gap-2">
                {d.bars.map((h, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "min-w-0 flex-1 rounded-t-[5px]",
                      i === d.bars.length - 1 ? "bg-[#0c9256]" : "bg-[#a7dfc1]",
                    )}
                    style={{ height: h }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-micro text-[#7c8a81]">
                <span>{d.chartStart}</span>
                <span>{d.chartEnd}</span>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl bg-[#ebf7f0] p-5 lg:w-[250px]">
              <div className="flex items-center gap-2 text-accent">
                <SparklesIcon size={16} />
                <span className="text-micro">{d.signal.eyebrow}</span>
              </div>
              <h3 className="text-h3 text-ink">{d.signal.heading}</h3>
              <p className="text-small text-[#526b5d]">{d.signal.description}</p>
              <p className="text-micro text-[#6f8579]">{d.signal.source}</p>
            </div>
          </div>

          <p className={clsx("hidden text-micro text-[#89968f] md:block", hero ? "text-center" : "text-center lg:text-left")}>
            {d.caption}
          </p>
          <p className={clsx("text-[16px] leading-[1.2] text-black md:hidden", !hero && "text-center")}>
            {d.compactCaption}
          </p>
        </div>
      </div>
    </div>
  );
}
