"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { DEMO_HREF, pricing, type Billing } from "@/lib/content";
import { Button } from "../ui/button";
import { CheckIcon } from "../ui/icons";
import { Reveal } from "../ui/reveal";

const options: { id: Billing; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function Swap({ value, className }: { value: string; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={value}
        className={className}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: [0.44, 0, 0.56, 1] }}
      >
        {value}
      </motion.p>
    </AnimatePresence>
  );
}

export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const yearly = billing === "yearly";

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="relative flex items-center gap-1 rounded-full bg-[#eef3e9] p-[5px] shadow-[inset_0_0_0_1px_#d8e4d1]"
        >
          <span
            aria-hidden="true"
            className={clsx(
              "absolute top-[5px] left-[5px] h-11 w-28 rounded-full bg-[#143d29] transition-transform duration-500 ease-framer",
              yearly && "translate-x-[116px]",
            )}
          />
          {options.map((option) => {
            const active = option.id === billing;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBilling(option.id)}
                className={clsx(
                  "relative z-[1] h-11 w-28 rounded-full text-button transition-colors duration-300",
                  active ? "text-white" : "text-[#52674d]",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p
          className={clsx(
            "rounded-full px-[13px] py-[9px] text-small transition-colors duration-300",
            yearly ? "bg-[#b4f185] text-accent" : "bg-[#f0f4eb] text-[#74857a]",
          )}
        >
          {pricing.discount}
        </p>
      </div>

      <div className="grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {pricing.plans.map((plan, i) => {
          const price = plan[billing];
          return (
            <Reveal key={plan.id} delay={0.08 * i} className={clsx(!plan.featured && "lg:pt-6")}>
              <article
                className={clsx(
                  "flex flex-col gap-6 rounded-[24px] p-8",
                  plan.featured
                    ? "bg-[linear-gradient(145deg,#e8f8d8_0%,#cdebcf_100%)] shadow-[inset_0_0_0_1px_#72b46d]"
                    : "bg-white shadow-[inset_0_0_0_1px_#dfe9e3]",
                )}
              >
                <span
                  className={clsx(
                    "self-start rounded-full px-3 py-[7px] text-micro",
                    plan.featured ? "bg-[#194b2f] text-[#c5f79f]" : "bg-[#f0f5ec] text-[#47654e]",
                  )}
                >
                  {plan.badge}
                </span>
                <h3 className="text-h3 text-ink">{plan.name}</h3>
                <div className="flex flex-col gap-[5px]">
                  <Swap value={price.price} className="text-[48px] leading-[1.1] font-medium tracking-[-2px] text-ink" />
                  <Swap value={price.cadence} className="text-small text-[#677c6f]" />
                  <Swap value={price.note} className="text-micro text-accent" />
                </div>
                <p className="text-small text-[#677c6f]">{plan.description}</p>
                <Button href={DEMO_HREF} className="w-full">
                  Get a demo
                </Button>
                <ul className="flex flex-col gap-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 py-0.5">
                      <CheckIcon size={16} className="mt-0.5 shrink-0 text-[#0c9256]" />
                      <span className="text-small text-[#52675b]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          );
        })}
      </div>

      <p className="max-w-[440px] text-center text-small text-[#74857a]">{pricing.terms}</p>
    </div>
  );
}
