import type { GeneralAlert, RSSAlertCategory } from "../../types/api";
import { KONKUK_ALERT_RSS_FEEDS } from "@linku/core";
import { errorLog } from '@/utils/logger';

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
      alertId: -(startId + index), // Negative IDs to distinguish from API data
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
const fetchRSSByCategory = async (
  category: RSSAlertCategory,
  startId: number
): Promise<GeneralAlert[]> => {
  try {
    const url = KONKUK_ALERT_RSS_FEEDS.find(
      (feed) => feed.category === category,
    )?.url;
    if (!url) {
      return [];
    }
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`RSS fetch failed for ${category}: ${response.status}`);
    }

    const xmlText = await response.text();
    return parseRSSToAlerts(xmlText, category, startId);
  } catch (error) {
    errorLog(`Error fetching RSS for ${category}:`, error);
    return []; // Return empty array on error
  }
};

/**
 * Fetches alerts from all RSS feeds
 * Fetches all categories in parallel and combines results
 */
export const getAlertsFromRSS = async (): Promise<GeneralAlert[]> => {
  try {
    const categories: RSSAlertCategory[] = KONKUK_ALERT_RSS_FEEDS.map(
      (feed) => feed.category,
    );

    // Fetch all RSS feeds in parallel
    const results = await Promise.all(
      categories.map((category, index) =>
        fetchRSSByCategory(category, index * 1000 + 1)
      )
    );

    // Combine all results
    return results.flat();
  } catch (error) {
    errorLog("Error fetching RSS feeds:", error);
    throw error;
  }
};
