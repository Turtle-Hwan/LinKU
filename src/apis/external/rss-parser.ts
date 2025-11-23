import type { GeneralAlert, RSSAlertCategory } from "../../types/api";

/**
 * RSS URL configuration for each category
 */
const RSS_URLS: Record<RSSAlertCategory, string> = {
  학사: "https://www.konkuk.ac.kr/bbs/konkuk/234/rssList.do?row=50",
  장학: "https://www.konkuk.ac.kr/bbs/konkuk/235/rssList.do?row=50",
  국제: "https://www.konkuk.ac.kr/bbs/konkuk/237/rssList.do?row=50",
  학생: "https://www.konkuk.ac.kr/bbs/konkuk/238/rssList.do?row=50",
  일반: "https://www.konkuk.ac.kr/bbs/konkuk/240/rssList.do?row=50",
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
      alertId: -(startId + index), // Negative IDs to distinguish from API data
      title,
      content: description,
      category,
      url: link,
      publishedAt,
      isRead: false,
    });
  });

  return alerts;
};

/**
 * Fetches alerts from a single RSS feed
 */
const fetchRSSByCategory = async (
  category: RSSAlertCategory,
  startId: number
): Promise<GeneralAlert[]> => {
  try {
    const url = RSS_URLS[category];
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`RSS fetch failed for ${category}: ${response.status}`);
    }

    const xmlText = await response.text();
    return parseRSSToAlerts(xmlText, category, startId);
  } catch (error) {
    console.error(`Error fetching RSS for ${category}:`, error);
    return []; // Return empty array on error
  }
};

/**
 * Fetches alerts from all RSS feeds
 * Fetches all categories in parallel and combines results
 */
export const getAlertsFromRSS = async (): Promise<GeneralAlert[]> => {
  try {
    const categories: RSSAlertCategory[] = [
      "학사",
      "장학",
      "국제",
      "학생",
      "일반",
    ];

    // Fetch all RSS feeds in parallel
    const results = await Promise.all(
      categories.map((category, index) =>
        fetchRSSByCategory(category, index * 1000 + 1)
      )
    );

    // Combine all results
    return results.flat();
  } catch (error) {
    console.error("Error fetching RSS feeds:", error);
    throw error;
  }
};
