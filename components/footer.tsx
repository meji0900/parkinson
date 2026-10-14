import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="foot">
      <div className="in">
        <nav aria-label="Footer">
          <Link href="/#live">Live console</Link>
          <Link href="/#predict">Make a prediction</Link>
          <Link href="/findings">Findings</Link>
          <Link href="/#receipts">Receipts</Link>
          <Link href="/chain">On-chain registry</Link>
          <Link href="/report">Daily report</Link>
          <Link href="/agents">Connect your agent</Link>
          <a href={`https://x.com/${BRAND.x}`} target="_blank" rel="noreferrer">x.com/{BRAND.x}</a>
        </nav>
        <p style={{ margin: 0 }}>
          Data from Open Targets, the Human Protein Atlas, ClinicalTrials.gov, PubMed and Reactome. Nothing here has been tested in a lab, and none of it is medical advice.
          The {BRAND.ticker} token is not a claim on any research result.
        </p>
      </div>
    </footer>
  );
}
