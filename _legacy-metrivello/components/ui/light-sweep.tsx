"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";

type LightSweepProps = {
  color: string;
  /** Width of the light band in px. */
  band?: number;
  className?: string;
};

/** A skewed band of light that sweeps across its parent once, when it scrolls into view. */
export function LightSweep({ color, band = 168, className }: LightSweepProps) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 z-[2] overflow-hidden", className)}>
      <motion.div
        className="absolute inset-y-0"
        style={{
          width: band,
          skewX: -12,
          backgroundImage: `linear-gradient(100deg, transparent, ${color}, transparent)`,
        }}
        initial={{ left: "-40%", opacity: 0 }}
        whileInView={{ left: "120%", opacity: [0, 0.7, 0] }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1.6, ease: [0.44, 0, 0.56, 1], delay: 0.3 }}
      />
    </div>
  );
}
