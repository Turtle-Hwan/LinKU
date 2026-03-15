import { createSitemapEntries } from "@linku/seo";
import { getLocalizedPublicPaths } from "@/lib/intl";
import { publicRoutePaths, siteEnv } from "@/lib/site";

export default function sitemap() {
  const localizedPublicRoutePaths = getLocalizedPublicPaths(publicRoutePaths);

  return createSitemapEntries(
    localizedPublicRoutePaths.map((path) => ({
      path,
      changeFrequency: path === "/" ? "daily" : "weekly",
      priority: path === "/" ? 1 : 0.7,
    })),
    siteEnv.siteUrl,
  );
}
