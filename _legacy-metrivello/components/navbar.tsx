"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { DEMO_HREF, navLinks } from "@/lib/content";
import { Button } from "./ui/button";
import { Logo } from "./ui/logo";
import { TextLink } from "./ui/text-link";

/** Floating navigation, inset 20px from the viewport edges. */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-5 z-50 px-5">
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-[26px] bg-white shadow-[inset_0_0_0_1px_#19432f1a] lg:block">
        <nav aria-label="Main" className="flex items-center gap-4 py-2.5 pr-2.5 pl-6">
          <a href="/#overview" className="flex shrink-0 items-center py-[3px]" aria-label="Metrivello home">
            <Logo width={168} priority />
          </a>
          <ul className="flex flex-1 items-center justify-center gap-3.5">
            {navLinks.map((link) => (
              <li key={link.label} className="flex">
                <TextLink href={link.href} className="text-ink">
                  {link.label}
                </TextLink>
              </li>
            ))}
          </ul>
          <Button href={DEMO_HREF}>Get a demo</Button>
        </nav>
      </div>

      {/* Tablet & phone */}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[inset_0_0_0_1px_#19432f1a] lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <a href="/#overview" className="flex flex-1 items-center py-[3px]" aria-label="Metrivello home" onClick={close}>
            <Logo width={148} priority />
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center text-ink"
          >
            <MenuIcon open={open} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.nav
              id="mobile-navigation"
              aria-label="Mobile"
              key="menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.44, 0, 0.56, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-start gap-4 px-6 pt-2.5 pb-6">
                {navLinks.map((link) => (
                  <TextLink key={link.label} href={link.href} onClick={close} className="text-ink">
                    {link.label}
                  </TextLink>
                ))}
                <Button href={DEMO_HREF} onClick={close} className="mt-0">
                  Get a demo
                </Button>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  const line = "absolute left-1 h-0.5 w-4 rounded-full bg-current transition-all duration-300 ease-framer";
  return (
    <span aria-hidden="true" className="relative block size-6">
      <span className={`${line} ${open ? "top-[11px] rotate-45" : "top-1"}`} />
      <span className={`${line} top-[11px] ${open ? "opacity-0" : "opacity-100"}`} />
      <span className={`${line} ${open ? "top-[11px] -rotate-45" : "top-[18px]"}`} />
    </span>
  );
}
