import { DEFAULT_SITE_URL } from "@linku/config";

const DEFAULT_DISALLOWED_PATHS = [
  "/api/",
  "/dashboard",
  "/links",
  "/favorites",
  "/settings",
  "/account",
  "/extension/connect",
] as const;

export function createRobots(
  siteUrl = DEFAULT_SITE_URL,
  disallow = DEFAULT_DISALLOWED_PATHS,
) {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: new URL(siteUrl).host,
  };
}
