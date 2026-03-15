import { createRobots } from "@linku/seo";
import { routing } from "@/i18n/routing";
import { siteEnv } from "@/lib/site";

export default function robots() {
  const localizedProtectedPaths = routing.locales
    .filter((locale) => locale !== routing.defaultLocale)
    .flatMap((locale) => [
      `/${locale}/dashboard`,
      `/${locale}/templates`,
      `/${locale}/editor`,
      `/${locale}/gallery`,
      `/${locale}/links`,
      `/${locale}/favorites`,
      `/${locale}/settings`,
      `/${locale}/account`,
      `/${locale}/extension/connect`,
    ]);

  return createRobots(siteEnv.siteUrl, [
    "/api/",
    "/dashboard",
    "/templates",
    "/editor",
    "/gallery",
    "/links",
    "/favorites",
    "/settings",
    "/account",
    "/extension/connect",
    ...localizedProtectedPaths,
  ]);
}
