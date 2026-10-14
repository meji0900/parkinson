import clsx from "clsx";
import type { ReactNode } from "react";
import { SmartLink } from "./smart-link";

type TextLinkProps = {
  href: string | null;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

/** Small text link whose underline grows from the left on hover. */
export function TextLink({ href, children, className, onClick }: TextLinkProps) {
  const inner = (
    <>
      <span className="text-small">{children}</span>
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-px w-0 bg-current transition-[width] duration-300 ease-framer group-hover:w-full"
      />
    </>
  );
  const classes = clsx("group relative inline-flex flex-col pb-[3px]", className);

  if (!href) {
    return <span className={classes}>{inner}</span>;
  }
  return (
    <SmartLink href={href} onClick={onClick} className={classes}>
      {inner}
    </SmartLink>
  );
}
