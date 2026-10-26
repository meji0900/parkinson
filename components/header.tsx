import Link from "next/link";
import { BRAND, MORE, NAV } from "@/lib/brand";
import { CopyCA } from "./copy-ca";
import { LivePulse } from "./live";
import { Mark } from "./mark";
import { MoreMenu } from "./more-menu";

const KEEP = new Set(["/#live", "/#predict"]);

export function Header() {
  return (
    <header className="top">
      <Link href="/" className="brand" aria-label={`${BRAND.name}, home`}>
        <Mark size={30} /> <span>{BRAND.name}</span>
      </Link>
      <LivePulse />
      <nav aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={KEEP.has(n.href) ? "keep" : n.href.startsWith("/#") ? "" : "opt"}>{n.label}</Link>
        ))}
        {/* the pages the bar drops on narrower screens come back at the top of More, only while the bar hides them */}
        <MoreMenu items={[...NAV.filter((n) => !n.href.startsWith("/#")).map((n) => ({ ...n, dup: true })), ...MORE.map((m) => ({ ...m }))]} x={BRAND.ca && BRAND.x ? BRAND.x : undefined} />
        <CopyCA ca={BRAND.ca} />
        {/* on phones the icon stays in the bar until the CA takes its room; then it moves into More */}
        {BRAND.x && (
          <a className={BRAND.ca ? "x" : "x keep"} href={`https://x.com/${BRAND.x}`} rel="noopener" target="_blank" aria-label={`${BRAND.name} on X`}>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" /></svg>
          </a>
        )}
      </nav>
    </header>
  );
}
