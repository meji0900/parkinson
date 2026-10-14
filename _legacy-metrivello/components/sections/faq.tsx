"use client";

import clsx from "clsx";
import Image from "next/image";
import { useId, useState } from "react";
import { faq } from "@/lib/content";
import { SparklesIcon } from "../ui/icons";
import { Reveal } from "../ui/reveal";
import { SectionHeading } from "../ui/section-heading";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rounded-2xl bg-white p-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 py-[3px] text-left"
      >
        <span className="flex-1 text-[17px] leading-[1.4] font-medium tracking-[-0.1px] text-ink">{q}</span>
        <span aria-hidden="true" className="relative size-[18px] shrink-0">
          <span className="absolute top-2 left-0.5 h-0.5 w-3.5 rounded-[2px] bg-accent" />
          <span
            className={clsx(
              "absolute top-0.5 left-2 h-3.5 w-0.5 rounded-[2px] bg-accent transition-transform duration-300 ease-framer",
              open && "rotate-90",
            )}
          />
        </span>
      </button>
      <div
        id={id}
        role="region"
        className={clsx(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-framer",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="pt-4 text-body text-muted">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" className="relative section-pad overflow-hidden bg-[#f1f5ec]">
      {/* Decorative orbit rings */}
      <div aria-hidden="true" className="absolute top-[120px] -left-[220px] size-[480px] rounded-full border border-[#d4e3c8]">
        <div className="absolute top-[69px] left-[69px] size-[340px] rounded-full border border-[#d4e3c8]" />
      </div>
      <div aria-hidden="true" className="absolute right-0 bottom-0 h-[400px] w-[120px] overflow-hidden opacity-25 md:w-[260px] md:opacity-65">
        <Image src="/images/faq-half-rings.svg" alt="" width={260} height={400} unoptimized className="absolute top-0 left-1/2 h-[400px] w-[260px] max-w-none -translate-x-1/2" />
      </div>

      <div className="relative z-[1] mx-auto flex max-w-[960px] flex-col items-center gap-9">
        <p className="flex items-center gap-2 rounded-full bg-[#e1eccd] px-4 py-2.5 text-small text-[#31573b]">
          <SparklesIcon size={16} />
          {faq.status}
        </p>
        <Reveal y={24} className="flex w-full justify-center">
          <SectionHeading eyebrow={faq.eyebrow} heading={faq.heading} description={faq.description} />
        </Reveal>
        <Reveal y={24} className="flex w-full flex-col gap-3">
          {faq.items.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
