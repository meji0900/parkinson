import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { CopyCAFull } from "./copy-ca";

const LINKS = [
  ["/parkinsons", "Parkinson's, 1817 to now"],
  ["/program", "The lysosome program"],
  ["/#predict", "Predict"],
  ["/forecast", "Forecast"],
  ["/findings", "Findings"],
  ["/arena", "Arena"],
  ["/gym", "Gym"],
  ["/agents", "Agents"],
  ["/report", "Daily report"],
  ["/case-studies", "Case studies"],
  ["/gene", "Genes"],
  ["/chain", "On-chain registry"],
  ["/paper", "Paper"],
] as const;

export function Footer() {
  return (
    <footer className="foot">
      <div className="foot-in">
        <nav className="foot-nav" aria-label="Footer">
          {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <p style={{ marginTop: 14 }}>
          {BRAND.x ? <><a href={`https://x.com/${BRAND.x}`} target="_blank" rel="noopener">x.com/{BRAND.x}</a> · </> : null}
          <a href={BRAND.siteUrl}>{BRAND.siteUrl.replace(/^https?:\/\//, "")}</a>
        </p>
        {BRAND.ca && <p>CA <CopyCAFull ca={BRAND.ca} /></p>}
        <p>
          Data: Open Targets, Human Protein Atlas, ClinicalTrials.gov, PubMed and Reactome. Nothing here has been tested in a lab, and
          none of it is medical advice. If you live with Parkinson&apos;s, your neurologist is the person to ask. The {BRAND.ticker} token is not a
          claim on any research result.
        </p>
      </div>
    </footer>
  );
}
