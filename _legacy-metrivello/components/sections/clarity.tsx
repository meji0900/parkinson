import Image from "next/image";
import { clarity as c, DEMO_HREF } from "@/lib/content";
import { Button } from "../ui/button";
import { ArrowRightIcon, SparklesIcon } from "../ui/icons";
import { LightSweep } from "../ui/light-sweep";
import { PaleSky } from "../ui/pale-sky";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

export function Clarity() {
  return (
    <section id="ai" className="section-pad bg-white">
      <div className="mx-auto flex max-w-[1600px] justify-center">
        <div className="relative flex w-full max-w-[1200px] flex-col items-center gap-4 overflow-hidden rounded-[24px] p-4 md:gap-8 md:rounded-[32px] md:p-10 lg:flex-row lg:items-start lg:gap-10">
          <PaleSky />

          {/* Illustrated AI answer */}
          <div className="relative z-[1] flex w-full flex-col gap-4 overflow-hidden rounded-[24px] bg-white/72 p-4 md:max-w-[544px] md:p-6 lg:w-[480px] lg:max-w-none lg:shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {c.chips.map((chip) => (
                <span key={chip} className="rounded-full bg-white/80 px-3 py-2 text-micro text-[#315e48]">
                  {chip}
                </span>
              ))}
            </div>

            <p className="rounded-[16px_16px_4px_16px] bg-white px-[22px] py-[18px] text-body text-ink">{c.question}</p>

            <Reveal>
              <div className="flex flex-col gap-[18px] rounded-2xl bg-white p-6 shadow-[0_8px_20px_rgba(22,70,45,0.08)]">
                <SparklesIcon size={26} className="text-[#16aa68]" />
                <h3 className="text-h3 text-ink">{c.answerHeading}</h3>
                <p className="text-small text-[#5a6b61]">{c.answer}</p>
                <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl">
                  <Image src="/images/feature-cost-per-lead.svg" alt="" fill unoptimized className="object-cover" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.evidence.map((item) => (
                    <span key={item} className="rounded-md bg-[#eff6f2] px-[9px] py-1.5 text-micro text-[#4b6656]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            <p className="text-micro text-[#65806e]">{c.disclaimer}</p>

            <Reveal>
              <div className="flex items-center gap-3 rounded-2xl bg-[#123b29] px-[18px] py-3.5">
                <ArrowRightIcon size={20} className="shrink-0 text-[#b4f185]" />
                <p className="text-small text-white">{c.nextStep}</p>
              </div>
            </Reveal>

            <LightSweep color="#fff" />
          </div>

          {/* Explanation */}
          <Reveal y={24} className="relative z-[1] w-full md:max-w-[544px] lg:max-w-none lg:flex-1">
            <div className="flex flex-col items-start gap-7 rounded-[24px] bg-white p-9">
              <SectionHeading align="left" eyebrow={c.eyebrow} heading={c.heading} description={c.description} />
              <Button href={DEMO_HREF}>Get a demo</Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
