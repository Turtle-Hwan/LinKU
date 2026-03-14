import { createSitemapEntries } from "@linku/seo";
import { publicRoutePaths, siteEnv } from "@/lib/site";

export default function sitemap() {
  return createSitemapEntries(
    publicRoutePaths.map((path) => ({
      path,
      changeFrequency: path === "/" ? "daily" : "weekly",
      priority: path === "/" ? 1 : 0.7,
    })),
    siteEnv.siteUrl,
  );
}
