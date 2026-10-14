"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { DEMO_HREF, hero } from "@/lib/content";
import { Button } from "../ui/button";
import { Dashboard } from "./dashboard";

export function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // Scroll parallax measured on the reference: meadow 0.16×, product 0.06× scroll distance
  const meadowY = useTransform(scrollY, (v) => (reduce ? 0 : v * 0.16));
  const productY = useTransform(scrollY, (v) => (reduce ? 0 : v * 0.06));

  return (
    <section id="overview" className="bg-white p-2.5">
      <div className="relative flex h-[970px] flex-col items-center gap-9 overflow-hidden rounded-[32px] px-5 pt-[120px] pb-8 md:gap-12 md:px-8 md:pb-10 lg:h-[880px] lg:gap-10 lg:px-10 lg:pt-[136px] lg:pb-0">
        <motion.div aria-hidden="true" className="absolute inset-x-0 -top-[3%] h-[104%]" style={{ y: meadowY }}>
          <motion.div
            className="relative size-full"
            initial={reduce ? false : { scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.4, ease: [0.44, 0, 0, 1] }}
          >
            <Image src="/images/meadow.png" alt="" fill priority sizes="100vw" className="object-cover" />
          </motion.div>
        </motion.div>

        <div className="relative z-[1] flex w-full max-w-[800px] flex-col items-center gap-5 text-center text-ink">
          <p className="text-eyebrow opacity-50">{hero.eyebrow}</p>
          <h1 className="max-w-[740px] text-display text-balance">{hero.heading}</h1>
          <p className="max-w-[560px] text-lead text-balance opacity-70">{hero.description}</p>
          <div className="flex w-full flex-col items-center gap-3 md:w-auto md:flex-row">
            <Button href={DEMO_HREF} className="w-full md:w-auto">
              {hero.primaryCta}
            </Button>
            <Button href={hero.secondaryCta.href} variant="light" className="w-full md:w-auto">
              {hero.secondaryCta.label}
            </Button>
          </div>
          <p className="text-small">{hero.note}</p>
        </div>

        <motion.div className="relative z-[1] flex w-full justify-center lg:max-w-[1100px]" style={{ y: productY }}>
          <Dashboard variant="hero" />
        </motion.div>
      </div>
    </section>
  );
}
