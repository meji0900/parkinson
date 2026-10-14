import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    return [{ source: "/mcp", destination: "/api/mcp" }];
  },
};

export default nextConfig;
