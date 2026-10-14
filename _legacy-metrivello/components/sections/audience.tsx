import Image from "next/image";
import { audience, DEMO_HREF } from "@/lib/content";
import { Button } from "../ui/button";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

export function Audience() {
  return (
    <section id="teams" className="section-pad bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-12">
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:gap-[60px]">
          <Reveal className="w-full lg:flex-1">
            <SectionHeading align="left" eyebrow={audience.eyebrow} heading={audience.heading} description={audience.description} />
          </Reveal>
          <Button href={DEMO_HREF}>Get a demo</Button>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-[90px]">
          <Reveal className="w-full lg:w-[45%] lg:shrink-0">
            <figure className="relative flex aspect-square w-full flex-col justify-end overflow-hidden rounded-[24px] p-6 md:aspect-auto md:h-[440px] lg:h-[460px]">
              <Image
                src="/images/team-meeting.jpg"
                alt="A marketing team reviewing a shared plan together in a meeting room"
                fill
                sizes="(min-width: 1200px) 45vw, 100vw"
                className="object-cover"
              />
              <figcaption className="relative rounded-xl bg-white/90 px-3.5 py-2.5 text-small text-ink">
                {audience.photoCaption}
              </figcaption>
            </figure>
          </Reveal>

          <ul className="flex flex-1 flex-col">
            {audience.roles.map((item, i) => (
              <li key={item.number}>
                <Reveal delay={0.06 * i} className="flex gap-6 py-[25px]">
                  <span className="w-7 shrink-0 text-small text-[#95a198]">{item.number}</span>
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-h3 text-ink">{item.role}</h3>
                    <p className="text-body text-muted">{item.description}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
