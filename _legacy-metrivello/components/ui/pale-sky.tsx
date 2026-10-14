"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

/** Faded meadow/sky backdrop that slowly zooms while its section scrolls past. */
export function PaleSky() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [1.15, 1.45]), { stiffness: 120, damping: 30, mass: 0.6 });

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[130%] overflow-hidden opacity-30">
      <motion.div className="relative size-full" style={{ scale: reduce ? 1.2 : scale }}>
        <Image src="/images/meadow.png" alt="" fill sizes="(min-width: 1200px) 1200px, 100vw" className="object-cover" />
      </motion.div>
    </div>
  );
}
