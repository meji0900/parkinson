import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { Prose } from "@/components/prose";
import { Button } from "@/components/ui/button";
import { getLegalDoc, legalDocs, legalMeta } from "@/lib/legal";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return legalDocs.map((doc) => ({ slug: doc.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return {};
  const title = `${doc.title} — Metrivello`;
  const image = `/images/og/legal-${doc.slug}.png`;
  return {
    title,
    description: doc.description,
    openGraph: { title, description: doc.description, images: [image] },
    twitter: { card: "summary_large_image", title, description: doc.description, images: [image] },
  };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <main>
      <PageHero surface="bg-[linear-gradient(135deg,#d9edf8_0%,#eef8f1_100%)]" className="gap-5 pb-12 text-center md:pb-16 lg:pb-[72px]">
        <p className="text-eyebrow text-accent">{legalMeta.eyebrow}</p>
        <h1 className="max-w-[800px] text-h2 text-balance text-ink">{doc.title}</h1>
        <p className="max-w-[680px] text-lead text-balance text-ink">{doc.summary}</p>
        <p className="text-small text-muted">{legalMeta.updated}</p>
      </PageHero>

      <div className="flex flex-col items-center px-6 pt-10 pb-16 md:px-8 md:pt-16 md:pb-20 lg:px-10 lg:pb-[100px]">
        <div className="flex w-full max-w-[760px] flex-col items-center gap-8">
          <p className="w-full text-small text-accent">{legalMeta.note}</p>
          <Prose blocks={doc.body} />
          <Button href="/support">Contact support</Button>
        </div>
      </div>
    </main>
  );
}
