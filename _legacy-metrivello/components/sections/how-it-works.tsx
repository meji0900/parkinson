import Image from "next/image";
import clsx from "clsx";
import { workflow } from "@/lib/content";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

// Editorial offset on desktop: 0 / 32 / 64px
const offsets = ["", "lg:pt-8", "lg:pt-16"];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-pad bg-[#ecf4e7]">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-12">
        <Reveal className="flex w-full justify-center">
          <SectionHeading eyebrow={workflow.eyebrow} heading={workflow.heading} description={workflow.description} />
        </Reveal>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-5">
          {workflow.steps.map((step, i) => (
            <div key={step.number} className={clsx("flex flex-col", offsets[i])}>
              <Reveal delay={0.08 * i} className="h-full">
                <article className="flex flex-col gap-[22px] rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_#d9e7d1]">
                  <span className="flex size-[46px] items-center justify-center rounded-2xl bg-[#193c2b] text-button text-[#bef397]">
                    {step.number}
                  </span>
                  <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl">
                    <Image src={step.image} alt="" fill unoptimized className="object-cover" />
                  </div>
                  <h3 className="text-h3 text-ink">{step.heading}</h3>
                  <p className="text-body text-muted">{step.description}</p>
                </article>
              </Reveal>
            </div>
          ))}
        </div>

        <p className="w-full text-center text-small text-[#6f8276]">{workflow.note}</p>
      </div>
    </section>
  );
}
