import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { CopyCA } from "./copy-ca";
import { LivePulse } from "./live";
import { Mark } from "./mark";

export function Header() {
  return (
    <header className="top">
      <Link href="/" className="wordmark" aria-label={`${BRAND.name} home`}>
        <Mark /> {BRAND.name}
      </Link>
      <LivePulse />
      <nav aria-label="Main">
        <Link href="/#live" className="keep">Live</Link>
        <Link href="/#predict">Predict</Link>
        <Link href="/findings" className="opt">Findings</Link>
        <Link href="/chain" className="keep">On-chain</Link>
        <Link href="/report" className="opt">Report</Link>
        <Link href="/agents" className="opt">Agents</Link>
        <CopyCA ca={BRAND.ca} />
      </nav>
    </header>
  );
}
