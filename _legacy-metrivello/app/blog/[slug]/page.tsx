import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { Prose } from "@/components/prose";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { articles, author, getArticle, getNextArticle } from "@/lib/articles";
import { DEMO_HREF } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const title = `${article.title} — Metrivello`;
  const image = `/images/og/blog-${article.slug}.png`;
  return {
    title,
    description: article.excerpt,
    openGraph: { type: "article", title, description: article.excerpt, images: [image] },
    twitter: { card: "summary_large_image", title, description: article.excerpt, images: [image] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const next = getNextArticle(slug);

  return (
    <main>
      <PageHero surface="bg-[#f0f7f3]" className="gap-6 pb-12 md:pb-16 lg:pb-20">
        <TextLink href="/blog" className="text-ink">
          {"< Back to all articles"}
        </TextLink>
        <p className="text-center text-eyebrow text-accent">{article.category}</p>
        <h1 className="max-w-[850px] text-center text-h2 text-balance text-ink">{article.title}</h1>
        <p className="max-w-[720px] text-center text-lead text-balance text-muted">{article.excerpt}</p>
        <p className="flex items-center gap-[18px] text-small text-[#738277]">
          <span>{article.author}</span>
          <time dateTime={article.dateTime}>{article.date}</time>
        </p>
      </PageHero>

      <article className="flex flex-col items-center gap-7 px-5 pt-8 pb-16 md:gap-12 md:px-8 md:pt-12 md:pb-20 lg:px-10">
        <div className="relative aspect-[350/220] w-full max-w-[960px] overflow-hidden rounded-[18px] md:aspect-[1.6] md:rounded-[24px]">
          <Image src={article.cover} alt="" fill priority unoptimized className="object-cover" />
        </div>

        <Prose blocks={article.body} className="max-w-[720px]" />

        <aside className="flex w-full max-w-[720px] flex-col gap-3 rounded-[18px] bg-[#f2f8f4] p-6 md:p-7">
          <h3 className="text-h3 text-ink">{author.name}</h3>
          <p className="text-body text-[#64776a]">{author.bio}</p>
        </aside>

        <Button href={DEMO_HREF}>Bring your next question</Button>

        {next ? (
          <nav aria-label="More from the journal" className="flex w-full max-w-[720px] flex-col gap-2.5 rounded-[18px] bg-[#f0f7f3] p-6">
            <p className="text-eyebrow text-accent">Next article</p>
            <Link href={`/blog/${next.slug}`} className="self-start text-body text-[#526259] underline-offset-4 hover:underline">
              {next.title}
            </Link>
          </nav>
        ) : null}
      </article>
    </main>
  );
}
