"use client";
// The rail beside the text: every section of the page as a rung on a ladder. Rungs fill in brown from the top
// as you read, the way Lewy pathology climbs the brain stage by stage. Built from the page itself, so every page
// gets one without listing its sections twice.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { id: string; title: string };
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sections = () => {
  const secs = [...document.querySelectorAll<HTMLElement>("main section.sec[id], main section[data-rail][id]")].filter((el) => el.querySelector("h2"));
  if (secs.length >= 2) return secs;
  // pages written as one document (the paper, the program) have headings but no sections
  return [...document.querySelectorAll<HTMLElement>("main h2")].map((h) => { if (!h.id) h.id = slug(h.textContent ?? ""); return h; });
};
const titleOf = (el: HTMLElement) => el.dataset.rail ?? (el.matches("h2") ? el : el.querySelector("h2")!).textContent!.trim();

export function SectionRail() {
  const path = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let raf = 0;
    // the active section is the last one whose top has passed the upper third of the screen
    const measure = () => {
      raf = 0;
      let last = -1;
      sections().forEach((el, i) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.35) last = i; });
      setActive(last);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    const t = window.setTimeout(() => {
      setItems(sections().map((el) => ({ id: el.id, title: titleOf(el) })));
      measure();
    }, 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, [path]);

  if (items.length < 2) return <div className="rail" aria-hidden />;
  return (
    <nav className="rail" aria-label="Sections of this page">
      <ol>
        {items.map((it, i) => (
          <li key={it.id} className={i < active ? "past" : i === active ? "now" : ""}>
            <a href={`#${it.id}`} aria-current={i === active ? "location" : undefined}><i aria-hidden /><span>{it.title}</span></a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
