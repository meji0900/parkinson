import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NeuronLayer } from "@/components/neurons/neuron-layer";
import { SectionRail } from "@/components/section-rail";
import { BRAND } from "@/lib/brand";
import { Providers } from "./providers";
import "./globals.css";

// Atkinson Hyperlegible was drawn for readers with low vision; many people with Parkinson's read with
// slowed eye movements and lower contrast sensitivity, so the type is chosen for them first.
// next/font has no fallback metrics for these two yet, so the size-adjusted fallback is off
const sans = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-sans", style: ["normal", "italic"], display: "swap", adjustFontFallback: false });
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-mono", style: ["normal", "italic"], display: "swap", adjustFontFallback: false });

const title = `${BRAND.name}, ${BRAND.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: title, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  openGraph: { type: "website", title, description: BRAND.description, url: "/", siteName: BRAND.name },
  twitter: { card: "summary_large_image", title, description: BRAND.description, ...(BRAND.x ? { site: `@${BRAND.x}` } : {}) },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#eff2f6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Providers>
          <NeuronLayer />
          <Header />
          <div className="frame">
            <SectionRail />
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
