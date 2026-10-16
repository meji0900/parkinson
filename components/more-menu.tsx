"use client";
// The pages that do not fit the bar. A native <details>, closed again on navigation, outside clicks and Escape.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function MoreMenu({ items }: { items: { href: string; label: string; dup?: boolean }[] }) {
  const box = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (box.current) box.current.open = false; }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current?.open && !box.current.contains(e.target as Node)) box.current.open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && box.current?.open) { box.current.open = false; box.current.querySelector("summary")?.focus(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <details className="more" ref={box}>
      <summary>More</summary>
      <div className="more-list">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={i.dup ? "dup" : undefined} onClick={() => { if (box.current) box.current.open = false; }}>{i.label}</Link>
        ))}
      </div>
    </details>
  );
}
