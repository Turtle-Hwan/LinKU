import { DEFAULT_SITE_URL } from "@linku/config";
import { buildCanonicalUrl } from "./metadata";

export interface LinkuSitemapEntry {
  path: string;
  lastModified?: string | Date;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

export function createSitemapEntries(
  entries: LinkuSitemapEntry[],
  siteUrl = DEFAULT_SITE_URL,
) {
  return entries.map((entry) => ({
    url: buildCanonicalUrl(entry.path, siteUrl),
    lastModified: entry.lastModified || new Date(),
    changeFrequency: entry.changeFrequency || "weekly",
    priority: entry.priority ?? 0.7,
  }));
}
