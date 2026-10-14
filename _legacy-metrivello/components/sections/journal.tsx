import clsx from "clsx";
import { journal } from "@/lib/content";
import { ArticleCard } from "../article-card";
import { Button } from "../ui/button";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

export function Journal() {
  return (
    <section id="journal" className="section-pad bg-[#f7faf8]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-12">
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:gap-10">
          <Reveal className="w-full lg:flex-1">
            <SectionHeading align="left" eyebrow={journal.eyebrow} heading={journal.heading} description={journal.description} />
          </Reveal>
          <Button href={journal.cta.href} variant="light">
            {journal.cta.label}
          </Button>
        </div>

        {/* 3 articles on phone/desktop, 2×2 on tablet */}
        <div className="grid w-full grid-cols-1 items-start gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {journal.articles.map((article, i) => (
            <Reveal
              key={article.slug}
              delay={0.08 * (i % 3)}
              className={clsx(i === 1 && "lg:pt-6", i === 3 && "hidden md:block lg:hidden")}
            >
              <ArticleCard {...article} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
