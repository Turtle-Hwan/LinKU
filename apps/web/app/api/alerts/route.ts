import { NextResponse } from "next/server";

interface WorkspaceAlertItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  href: string;
  publishedAt: string;
}

const RSS_FEEDS = [
  { category: "학사", url: "https://www.konkuk.ac.kr/bbs/konkuk/234/rssList.do?row=50" },
  { category: "대학", url: "https://www.konkuk.ac.kr/bbs/konkuk/235/rssList.do?row=50" },
  { category: "국제", url: "https://www.konkuk.ac.kr/bbs/konkuk/237/rssList.do?row=50" },
  { category: "학생", url: "https://www.konkuk.ac.kr/bbs/konkuk/238/rssList.do?row=50" },
  { category: "일반", url: "https://www.konkuk.ac.kr/bbs/konkuk/240/rssList.do?row=50" },
] as const;

const CAREER_URL = "https://www.konkuk.ac.kr/combBbs/konkuk/2/list.do";

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
    RSS_FEEDS.map(async (feed, feedIndex) => {
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
    .map((match, index) => {
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
  const response = await fetch(CAREER_URL, { next: { revalidate: 1800 } });
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
