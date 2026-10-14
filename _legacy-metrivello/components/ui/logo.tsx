import Image from "next/image";
import clsx from "clsx";

// Wordmark viewBox is 264.109 × 64
const RATIO = 264.109 / 64;

type LogoProps = {
  width: number;
  tone?: "dark" | "light";
  className?: string;
  priority?: boolean;
};

export function Logo({ width, tone = "dark", className, priority }: LogoProps) {
  return (
    <Image
      src={tone === "dark" ? "/images/logo-dark.svg" : "/images/logo-light.svg"}
      alt="Metrivello"
      width={width}
      height={Math.round(width / RATIO)}
      priority={priority}
      unoptimized
      className={clsx("block h-auto", className)}
      style={{ width }}
    />
  );
}
