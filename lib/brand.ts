// Everything that names the project lives here, so a rename is one file.
export const BRAND = {
  name: "engram",
  ticker: "$ENGRAM",
  tagline: "Alzheimer's research, in the open",
  description:
    "An agent that works on Alzheimer's disease in public. It reads six public sources about a gene, proposes an experiment, seals its predictions by hash before reading any data, and prints a receipt every time it fails.",
  x: process.env.NEXT_PUBLIC_X_HANDLE ?? "engram_agent",
  // mainnet token contract address (set once the token launches); empty shows "soon"
  ca: process.env.NEXT_PUBLIC_TOKEN_CA ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const NAV = [
  { href: "/#live", label: "Live" },
  { href: "/#predict", label: "Predict" },
  { href: "/findings", label: "Findings" },
  { href: "/chain", label: "On-chain" },
  { href: "/report", label: "Report" },
  { href: "/agents", label: "Agents" },
] as const;
