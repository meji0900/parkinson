import clsx from "clsx";
import type { ReactNode } from "react";

type PageHeroProps = {
  children: ReactNode;
  /** Background of the rounded surface (colour or gradient utility). */
  surface: string;
  /** Bottom padding of the surface on desktop/phone, which varies per page. */
  className?: string;
};

/** Rounded top surface used by the inner pages (blog, article, legal). */
export function PageHero({ children, surface, className }: PageHeroProps) {
  return (
    <section className="bg-white p-2.5">
      <div
        className={clsx(
          "flex flex-col items-center rounded-[32px] px-5 pt-[120px] md:px-8 lg:px-10 lg:pt-[136px]",
          surface,
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
