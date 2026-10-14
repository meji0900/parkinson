import Image from "next/image";
import clsx from "clsx";
import { stories } from "@/lib/content";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

function QuoteMark({ flipped = false }: { flipped?: boolean }) {
  // 20px-tall slot with the oversized glyph overflowing it, as in the reference.
  // The closing mark is the same glyph rotated 180°, which also moves it to the right edge.
  return (
    <div aria-hidden="true" className={clsx("h-5 w-full", flipped && "rotate-180")}>
      <span className="block text-display text-accent">“</span>
    </div>
  );
}

export function Stories() {
  return (
    <section id="stories" className="section-pad bg-[linear-gradient(#f6fbf9_0%,#eaf5f9_100%)]">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-12">
        <Reveal className="flex w-full justify-center">
          <SectionHeading eyebrow={stories.eyebrow} heading={stories.heading} description={stories.description} />
        </Reveal>

        <div className="grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-3">
          {stories.items.map((story, i) => (
            <Reveal key={story.name} delay={0.08 * i} className={clsx(i === 1 && "lg:pt-6")}>
              <figure className="flex flex-col gap-6 rounded-[20px] bg-white p-8 shadow-[inset_0_0_0_1px_#e5ece7]">
                <figcaption className="flex items-center gap-4">
                  <span className="relative size-[88px] shrink-0 overflow-hidden rounded-full">
                    <Image src={story.avatar} alt={`Illustrative portrait of ${story.name}`} fill sizes="88px" className="object-cover" />
                    <span aria-hidden="true" className="absolute inset-0 rounded-full border-[3px] border-[#e8f3e4]" />
                  </span>
                  <span className="flex flex-col gap-[3px]">
                    <span className="text-button text-ink">{story.name}</span>
                    <span className="text-micro text-[#77887d]">{story.role}</span>
                  </span>
                </figcaption>
                <QuoteMark />
                <blockquote className="text-lead text-ink">
                  <p>{story.quote}</p>
                </blockquote>
                <QuoteMark flipped />
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
