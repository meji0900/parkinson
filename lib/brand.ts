// Everything that names the project lives here, so a rename is one file.
// james: after James Parkinson, the London surgeon who described the "shaking palsy" in 1817.
export const BRAND = {
  name: "james",
  ticker: "$JAMES",
  disease: "Parkinson's",
  tagline: "Parkinson's research notebook",
  description:
    "An agent that works on Parkinson's disease in public. It reads six public sources about a gene, proposes an experiment, seals its predictions by hash before reading any data, tests them on a substantia nigra atlas, and prints a receipt every time it fails.",
  // X handle without the @; leave NEXT_PUBLIC_X_HANDLE empty to hide the link
  x: process.env.NEXT_PUBLIC_X_HANDLE ?? "",
  // mainnet token contract address (set once the token launches); empty shows "soon"
  ca: process.env.NEXT_PUBLIC_TOKEN_CA ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const NAV = [
  { href: "/#live", label: "Live" },
  { href: "/#predict", label: "Predict" },
  { href: "/forecast", label: "Forecast" },
  { href: "/findings", label: "Findings" },
  { href: "/arena", label: "Arena" },
  { href: "/agents", label: "Agents" },
  { href: "/gym", label: "Gym" },
  { href: "/report", label: "Report" },
] as const;

export const MORE = [
  { href: "/case-studies", label: "Case studies" },
  { href: "/parkinsons", label: "Parkinson's, 1817 to now" },
  { href: "/program", label: "The lysosome program" },
  { href: "/paper", label: "Paper" },
  { href: "/gene", label: "Genes" },
  { href: "/chain", label: "On-chain registry" },
  { href: "/#receipts", label: "Receipts" },
] as const;
