import clsx from "clsx";

type SectionHeadingProps = {
  eyebrow: string;
  heading: string;
  description?: string;
  align?: "center" | "left";
  /** Colours for dark surfaces (footer). */
  className?: string;
};

export function SectionHeading({ eyebrow, heading, description, align = "center", className }: SectionHeadingProps) {
  const center = align === "center";
  return (
    <div
      className={clsx(
        "flex w-full flex-col gap-4",
        center ? "max-w-[760px] items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <p className="text-eyebrow text-accent">{eyebrow}</p>
      <h2 className="text-h2 text-balance text-ink">{heading}</h2>
      {description ? <p className="max-w-[560px] text-body text-balance text-muted">{description}</p> : null}
    </div>
  );
}
