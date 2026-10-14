import { Audience } from "@/components/sections/audience";
import { Clarity } from "@/components/sections/clarity";
import { ConnectedTools } from "@/components/sections/connected-tools";
import { Faq } from "@/components/sections/faq";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Journal } from "@/components/sections/journal";
import { Pricing } from "@/components/sections/pricing";
import { ReportingGap } from "@/components/sections/reporting-gap";
import { Stories } from "@/components/sections/stories";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <ConnectedTools />
      <Features />
      <ReportingGap />
      <HowItWorks />
      <Audience />
      <Stories />
      <Pricing />
      <Journal />
      <Clarity />
      <Faq />
    </main>
  );
}
