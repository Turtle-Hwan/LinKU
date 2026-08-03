import type { GeneralAlert, RSSAlertCategory } from "../../types/api";

/**
 * RSS URL configuration for each category
 */
const RSS_URLS: Record<RSSAlertCategory, string> = {
  학사: "https://www.konkuk.ac.kr/bbs/konkuk/234/rssList.do",
  장학: "https://www.konkuk.ac.kr/bbs/konkuk/235/rssList.do",
  국제: "https://www.konkuk.ac.kr/bbs/konkuk/237/rssList.do",
  학생: "https://www.konkuk.ac.kr/bbs/konkuk/238/rssList.do",
  일반: "https://www.konkuk.ac.kr/bbs/konkuk/240/rssList.do",
};

export const RSS_ALERT_PAGE_SIZE = 50;

const RSS_CATEGORY_START_IDS: Record<RSSAlertCategory, number> = {
  학사: 1,
  장학: 1001,
  국제: 2001,
  학생: 3001,
  일반: 4001,
};

const getStableAlertId = (link: string, fallbackId: number) => {
  const articleId = link.match(/\/(\d+)\/artclView\.do/)?.[1];
  return articleId ? -Number(articleId) : -fallbackId;
};

/**
 * Parses RSS XML and converts to GeneralAlert array for a specific category
 */
const parseRSSToAlerts = (
  xmlText: string,
  category: RSSAlertCategory,
  startId: number
): GeneralAlert[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const items = xmlDoc.querySelectorAll("item");
  const alerts: GeneralAlert[] = [];

  items.forEach((item, index) => {
    const title = item.querySelector("title")?.textContent || "";
    const link = item.querySelector("link")?.textContent || "";
    const description = item.querySelector("description")?.textContent || "";
    const pubDate = item.querySelector("pubDate")?.textContent || "";

    // Convert relative URL to absolute URL
    let absoluteUrl = link;
    if (link) {
      try {
        // URL 생성자는 상대/절대 URL을 모두 자연스럽게 처리한다.
        absoluteUrl = new URL(link, "https://www.konkuk.ac.kr").href;
      } catch {
        // 실패하면 absoluteUrl은 원래 link를 유지한다.
      }
    }

    // Convert pubDate to ISO string
    let publishedAt = new Date().toISOString();
    if (pubDate) {
      try {
        publishedAt = new Date(pubDate).toISOString();
      } catch {
        // Use current date if parsing fails
      }
    }

    alerts.push({
      // The article number in the URL is stable across RSS page shifts.
      // Keep external IDs negative to distinguish them from backend IDs.
      alertId: getStableAlertId(link, startId + index),
      title,
      content: description,
      category,
      url: absoluteUrl,
      publishedAt,
      isRead: false,
    });
  });

  return alerts;
};

/**
 * Fetches alerts from a single RSS feed
 */
export const getAlertsFromRSSPage = async (
  category: RSSAlertCategory,
  page: number,
): Promise<GeneralAlert[]> => {
  const url = new URL(RSS_URLS[category]);
  url.searchParams.set("row", String(RSS_ALERT_PAGE_SIZE));
  url.searchParams.set("page", String(page));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`RSS fetch failed for ${category}: ${response.status}`);
  }

  const xmlText = await response.text();
  const pageOffset = (page - 1) * RSS_ALERT_PAGE_SIZE;
  return parseRSSToAlerts(
    xmlText,
    category,
    RSS_CATEGORY_START_IDS[category] + pageOffset,
  );
};
