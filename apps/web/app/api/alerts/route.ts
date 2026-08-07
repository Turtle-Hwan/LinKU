import { NextResponse } from "next/server";
import {
  KONKUK_ALERT_RSS_FEEDS,
  KONKUK_CAREER_ALERT_URL,
} from "@linku/core";
import type { WorkspaceAlertItem } from "@linku/shared-types";

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

async function fetchRssAlerts() {
  const results = await Promise.all(
    KONKUK_ALERT_RSS_FEEDS.map(async (feed, feedIndex) => {
      const response = await fetch(feed.url, { next: { revalidate: 1800 } });
      if (!response.ok) {
        return [];
      }

      const xml = await response.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match, itemIndex) => {
        const block = match[1];
        const href = extractTag(block, "link");
        const publishedAt = extractTag(block, "pubDate");

        return {
          id: `rss-${feedIndex}-${itemIndex}`,
          title: extractTag(block, "title"),
          excerpt: extractTag(block, "description"),
          category: feed.category,
          href: href.startsWith("http")
            ? href
            : new URL(href, "https://www.konkuk.ac.kr").toString(),
          publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
        } satisfies WorkspaceAlertItem;
      });
    }),
  );

  return results.flat();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, " "));
}

function parseCareerAlerts(html: string) {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((match, index): WorkspaceAlertItem | null => {
      const row = match[0];
      const hrefMatch = row.match(
        /jf_combBbs_view\('([^']+)','([^']+)','([^']+)','([^']+)'\)/,
      );

      const cells = [...row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((item) =>
        stripTags(item[1]),
      );

      if (!hrefMatch || cells.length < 4) {
        return null;
      }

      const href = `https://www.konkuk.ac.kr/combBbs/${hrefMatch[1]}/${hrefMatch[2]}/${hrefMatch[3]}/${hrefMatch[4]}/view.do`;
      const title = cells[1];
      const publishedAt =
        cells[3] && /\d{4}\.\d{2}\.\d{2}/.test(cells[3])
          ? new Date(cells[3].replace(/\./g, "-")).toISOString()
          : new Date().toISOString();

      if (!title) {
        return null;
      }

      return {
        id: `career-${index}`,
        title,
        excerpt: "",
        category: "취창업",
        href,
        publishedAt,
      } satisfies WorkspaceAlertItem;
    })
    .filter((item): item is WorkspaceAlertItem => item !== null);
}

async function fetchCareerAlerts() {
  const response = await fetch(KONKUK_CAREER_ALERT_URL, {
    next: { revalidate: 1800 },
  });
  if (!response.ok) {
    return [];
  }

  return parseCareerAlerts(await response.text());
}

export async function GET() {
  try {
    const [rssAlerts, careerAlerts] = await Promise.all([
      fetchRssAlerts(),
      fetchCareerAlerts(),
    ]);

    const alerts = [...rssAlerts, ...careerAlerts].sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    );

    return NextResponse.json(alerts);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to fetch LinKU alerts.",
      },
      { status: 500 },
    );
  }
}
