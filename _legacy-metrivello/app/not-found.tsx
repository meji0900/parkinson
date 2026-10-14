import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main>
      <PageHero surface="bg-[linear-gradient(135deg,#d9edf8_0%,#f0f8ef_100%)]" className="gap-5 pb-16 text-center lg:pb-24">
        <p className="text-eyebrow text-accent">PAGE NOT FOUND</p>
        <h1 className="max-w-[760px] text-h2 text-balance text-ink">This page isn’t part of the picture.</h1>
        <p className="max-w-[560px] text-body text-balance text-muted">
          The link may be outdated or mistyped. Head back to the overview to keep exploring.
        </p>
        <Button href="/">Back to the homepage</Button>
      </PageHero>
    </main>
  );
}
