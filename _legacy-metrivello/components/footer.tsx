import clsx from "clsx";
import { DEMO_HREF, footer as f } from "@/lib/content";
import { Button } from "./ui/button";
import { LightSweep } from "./ui/light-sweep";
import { Logo } from "./ui/logo";
import { Reveal } from "./ui/reveal";
import { TextLink } from "./ui/text-link";

type Column = { title: string; links: { label: string; href: string | null }[] };

// Product, Resources and Let's talk links sit in 2px-padded rows in the reference.
const PADDED = new Set(["PRODUCT", "RESOURCES", "LET’S TALK"]);

function LinkColumn({ column, className }: { column: Column; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-start gap-4", className)}>
      <p className="text-micro text-[#79968a]">{column.title}</p>
      <ul className="flex flex-col items-start gap-4">
        {column.links.map((link) => (
          <li key={link.label} className={clsx("flex", PADDED.has(column.title) && "py-0.5")}>
            <TextLink href={link.href} className="text-[#dce9e0]">
              {link.label}
            </TextLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { product, resources, legal, contact, social } = f.columns;
  return (
    <footer className="relative overflow-hidden bg-forest px-5 pt-16 md:px-8 md:pt-[72px] lg:px-10 lg:pt-[70px]">
      <div className="relative z-[1] mx-auto flex max-w-[1600px] flex-col gap-[52px]">
        <Reveal className="flex flex-col gap-7 md:flex-row lg:gap-[60px]">
          <div className="flex flex-1 flex-col gap-[18px]">
            <p className="text-eyebrow text-[#86c8a2]">{f.eyebrow}</p>
            <h2 className="max-w-[620px] text-h2 text-white">{f.heading}</h2>
          </div>
          <div className="flex flex-col items-start gap-[22px] md:flex-1 lg:w-[433px] lg:flex-none">
            <p className="text-body text-[#acbdb2]">{f.description}</p>
            <Button href={DEMO_HREF} variant="light">
              Get a demo
            </Button>
          </div>
        </Reveal>

        <div className="h-px bg-[#64776a] opacity-20" />

        {/* Phone: two stacked columns */}
        <div className="grid grid-cols-2 gap-x-[62px] md:hidden">
          <div className="flex flex-col gap-[62px]">
            <LinkColumn column={product} />
            <LinkColumn column={legal} />
            <LinkColumn column={contact} />
          </div>
          <div className="flex flex-col gap-[62px]">
            <LinkColumn column={resources} />
            <LinkColumn column={social} />
          </div>
        </div>
        {/* Tablet & desktop: five columns */}
        <div className="hidden gap-12 md:flex lg:gap-[70px]">
          {[product, resources, legal, contact, social].map((column) => (
            <LinkColumn key={column.title} column={column} className="flex-1" />
          ))}
        </div>

        <div className="h-px bg-[#64776a] opacity-20" />

        <div className="flex flex-col gap-3 text-micro text-[#64776a] md:gap-6 lg:flex-row lg:gap-[60px]">
          <p className="lg:flex-1">
            {f.credit.prefix}{" "}
            <a href={f.credit.href} target="_blank" rel="noopener noreferrer" className="text-[#e8f7ee] hover:underline">
              {f.credit.name}
            </a>
          </p>
          <p className="lg:flex-1 lg:text-center">{f.copyright}</p>
          <p className="lg:flex-1 lg:text-right">{f.disclaimer}</p>
        </div>

        {/* Oversized wordmark, cropped by the bottom edge */}
        <Reveal className="h-[57px] overflow-hidden md:h-[125px] lg:h-[192px]">
          <Logo width={1600} tone="light" className="w-full!" />
        </Reveal>
      </div>
      <LightSweep color="#a7dfc1" band={504} />
    </footer>
  );
}
