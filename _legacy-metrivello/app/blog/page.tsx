import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/ui/reveal";
import { articles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Marketing Analytics & AI Journal — Metrivello",
  description:
    "Practical guides to marketing analytics, AI insights, dashboards and reporting. Ask better questions and turn performance data into useful decisions.",
};

export default function BlogPage() {
  return (
    <main>
      <PageHero surface="bg-[linear-gradient(135deg,#d9edf8_0%,#f0f8ef_100%)]" className="pb-12 md:pb-16 lg:pb-20">
        <div className="flex w-full max-w-[760px] flex-col items-center gap-4 text-center">
          <p className="text-eyebrow text-accent">THE METRIVELLO JOURNAL</p>
          <h1 className="text-h2 text-balance text-ink">Better questions. Clearer marketing.</h1>
          <p className="max-w-[560px] text-body text-balance text-muted">
            Practical notes on measurement, AI, and the way teams make sense of performance.
          </p>
        </div>
      </PageHero>

      <section className="px-5 py-14 md:px-8 md:pt-16 md:pb-20 lg:px-10 lg:pt-20 lg:pb-[100px]">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, i) => (
            <Reveal key={article.slug} delay={0.06 * (i % 3)}>
              <ArticleCard {...article} />
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
