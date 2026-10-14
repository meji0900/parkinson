import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NeuronLayer } from "@/components/neurons/neuron-layer";
import { BRAND } from "@/lib/brand";
import { Providers } from "./providers";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"], display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

const title = `${BRAND.name}: ${BRAND.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: title, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  openGraph: { type: "website", title, description: BRAND.description, url: "/" },
  twitter: { card: "summary_large_image", title, description: BRAND.description },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7eff3" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <NeuronLayer />
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
