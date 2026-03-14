import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@linku/config",
    "@linku/core",
    "@linku/platform",
    "@linku/seo",
    "@linku/ui",
  ],
};

export default nextConfig;
