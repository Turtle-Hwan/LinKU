import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@linku/config",
    "@linku/core",
    "@linku/platform",
    "@linku/seo",
    "@linku/ui",
  ],
};

export default withNextIntl(nextConfig);
