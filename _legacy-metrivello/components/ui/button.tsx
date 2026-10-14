import clsx from "clsx";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "./icons";
import { SmartLink } from "./smart-link";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "light";
  className?: string;
  onClick?: () => void;
};

const variants = {
  primary: { base: "bg-ink text-white", fill: "bg-accent-bright" },
  light: { base: "bg-white text-ink", fill: "bg-lime" },
};

/**
 * Pill CTA from the reference: on hover a colour fill rises from the bottom
 * and the arrow slides out to the right while a second arrow slides in.
 */
export function Button({ href, children, variant = "primary", className, onClick }: ButtonProps) {
  const v = variants[variant];
  return (
    <SmartLink
      href={href}
      onClick={onClick}
      className={clsx(
        "group relative isolate inline-flex h-[46px] shrink-0 items-center justify-center gap-3 overflow-hidden rounded-full px-[22px] text-button whitespace-nowrap",
        v.base,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "absolute inset-x-0 bottom-0 -z-10 h-0 rounded-full transition-[height] duration-500 ease-framer group-hover:h-full",
          v.fill,
        )}
      />
      <span>{children}</span>
      <span aria-hidden="true" className="relative block size-[18px] overflow-hidden">
        <ArrowRightIcon className="absolute top-px left-px transition-transform duration-500 ease-framer group-hover:translate-x-6" />
        <ArrowRightIcon className="absolute top-px -left-[23px] transition-transform duration-500 ease-framer group-hover:translate-x-6" />
      </span>
    </SmartLink>
  );
}
