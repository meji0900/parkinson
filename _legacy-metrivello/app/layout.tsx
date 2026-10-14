import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SmoothScroll } from "@/components/smooth-scroll";
import "./globals.css";

const title = "Metrivello — AI Marketing Analytics Dashboard";
const description =
  "Bring your marketing tools into one clear dashboard. Explore channel performance, understand changes with AI, and turn your data into better next steps.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  openGraph: { type: "website", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
  icons: {
    icon: [
      { url: "/images/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/images/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
