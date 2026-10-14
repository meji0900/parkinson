"use client";

import Lenis from "lenis";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Lenis smooth scrolling (the reference ships the same component) plus
 * animated scrolling for in-page anchor links such as "/#pricing".
 * Anchor links to another page ("/#pricing" from /blog) use client-side navigation.
 */
export function SmoothScroll() {
  const router = useRouter();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduce ? null : new Lenis({ lerp: 0.1, smoothWheel: true });
    let frame = 0;
    if (lenis) {
      frame = requestAnimationFrame(function raf(time) {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      });
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.hash) return;

      if (url.pathname !== window.location.pathname) {
        event.preventDefault();
        router.push(url.pathname + url.hash);
        return;
      }
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.4 });
      else target.scrollIntoView();
      history.pushState(null, "", url.hash);
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [router]);

  return null;
}
