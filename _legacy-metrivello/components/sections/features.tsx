import Image from "next/image";
import clsx from "clsx";
import { features } from "@/lib/content";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

export function Features() {
  return (
    <section id="features" className="section-pad bg-[linear-gradient(#fff_0%,#eff7f4_48%,#f6faf7_100%)]">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-12">
        <Reveal className="flex w-full justify-center">
          <SectionHeading eyebrow={features.eyebrow} heading={features.heading} description={features.description} />
        </Reveal>

        {/* Bounded editorial grid: 1 col → 2×350px → 4×350px, even items offset on desktop */}
        <div className="grid w-full grid-cols-1 gap-5 md:w-auto md:grid-cols-[repeat(2,350px)] md:gap-6 lg:gap-x-6 lg:gap-y-7 lg:pb-8 xl:grid-cols-[repeat(4,350px)]">
          {features.items.map((item, i) => (
            <Reveal key={item.heading} className={clsx(i % 2 === 1 && "lg:pt-8")}>
              <article className="flex flex-col gap-6 rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_#dce9e2]">
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#d0eedd_0%,#f9fcfa_100%)] px-3.5 py-[18px]">
                  <div className="relative aspect-[2/1] w-full">
                    <Image src={item.image} alt="" fill unoptimized className="object-cover" />
                  </div>
                  <p className="text-center text-h2 text-ink">{item.metric}</p>
                  <p className="text-center text-micro text-[#567163]">{item.context}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-h3 text-ink">{item.heading}</h3>
                  <p className="text-small text-muted">{item.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
