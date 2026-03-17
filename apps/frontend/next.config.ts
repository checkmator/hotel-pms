import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Turbopack is used only in dev (next dev --turbopack)
    // Production build uses the standard webpack bundler
  },
};

export default nextConfig;
