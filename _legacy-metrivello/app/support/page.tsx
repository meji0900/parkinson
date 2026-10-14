import type { Metadata } from "next";
import Image from "next/image";
import { CheckIcon } from "@/components/ui/icons";
import { RequestForm } from "./request-form";

export const metadata: Metadata = {
  title: "Get a Demo & Contact Support — Metrivello",
  description:
    "Request a Metrivello demo or ask a product question. Tell us about your marketing tools, reporting goals or support needs, and plan your next step.",
};

const benefits = [
  { heading: "A focused walkthrough", description: "See how your team could use the dashboard." },
  { heading: "A useful conversation", description: "Bring your goals and the tools you already use." },
  { heading: "Support when you need it", description: "Share a question or describe what is getting in your way." },
];

export default function SupportPage() {
  return (
    <main className="bg-white p-2.5">
      <section className="relative flex flex-col items-center gap-12 overflow-hidden rounded-[32px] bg-[#f2f8f5] px-5 pt-[120px] pb-5 md:px-8 md:pb-10 lg:px-10 lg:pt-[136px] lg:pb-[100px]">
        <div aria-hidden="true" className="absolute inset-x-0 -top-[4%] h-[104%]">
          <Image src="/images/meadow.png" alt="" fill priority sizes="100vw" className="object-cover" />
        </div>

        <div className="relative z-[1] flex w-full max-w-[760px] flex-col items-center gap-4 text-center text-ink">
          <p className="text-eyebrow opacity-50">DEMOS, QUESTIONS &amp; SUPPORT</p>
          <h1 className="text-h2 text-balance">Let’s start with what you need.</h1>
          <p className="max-w-[560px] text-body text-balance opacity-70">
            Want a closer look at Metrivello or help with a question? Send a short note and tell us how we can help.
          </p>
        </div>

        <div className="relative z-[1] flex w-full max-w-[1100px] flex-col items-start gap-5 lg:flex-row lg:gap-16">
          <aside className="flex w-full flex-col gap-6 rounded-[24px] bg-white/82 p-9 lg:w-[374px] lg:shrink-0">
            <h2 className="text-h3 text-ink">Start with your next question.</h2>
            <p className="text-body text-[#64776a]">
              Tell us what you would like to understand, connect, or improve. We’ll point you toward the right next step.
            </p>
            <ul className="flex flex-col gap-6">
              {benefits.map((benefit) => (
                <li key={benefit.heading} className="flex gap-3">
                  <CheckIcon size={20} className="shrink-0 text-accent" />
                  <span className="flex flex-col gap-1.5 text-small">
                    <span className="text-ink">{benefit.heading}</span>
                    <span className="text-[#64776a]">{benefit.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
          <RequestForm />
        </div>
      </section>
    </main>
  );
}
