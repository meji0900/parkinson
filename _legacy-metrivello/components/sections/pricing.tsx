import { pricing } from "@/lib/content";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";
import { Dashboard } from "./dashboard";
import { PricingPlans } from "./pricing-plans";

export function Pricing() {
  return (
    <section id="pricing" className="section-pad bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-12">
        <Reveal className="flex w-full justify-center">
          <SectionHeading eyebrow={pricing.eyebrow} heading={pricing.heading} description={pricing.description} />
        </Reveal>
        <PricingPlans />
        <Reveal className="w-full">
          <Dashboard variant="showcase" />
        </Reveal>
      </div>
    </section>
  );
}
