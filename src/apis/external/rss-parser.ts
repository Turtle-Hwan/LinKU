import type { Alert, AlertCategory } from "../../types/api";

const RSS_URL = "https://www.konkuk.ac.kr/bbs/konkuk/234/rssList.do?row=50";

/**
 * Maps RSS item author and title to AlertCategory
 */
const mapToAlertCategory = (title: string, author?: string): AlertCategory => {
  const titleLower = title.toLowerCase();
  const authorLower = (author || "").toLowerCase();

  // Author-based mapping (most reliable)
  if (authorLower.includes("학사")) {
    return "학사";
  }
  if (authorLower.includes("국제")) {
    return "국제";
  }
  if (authorLower.includes("학생")) {
    return "학생";
  }

  // Title-based mapping for specific keywords
  if (titleLower.includes("장학") || titleLower.includes("등록금")) {
    return "장학";
  }
  if (titleLower.includes("채용") || titleLower.includes("취업") || titleLower.includes("창업")) {
    return "채용";
  }
  if (titleLower.includes("에너지") || titleLower.includes("절약")) {
    return "에너지절약";
  }
  if (titleLower.includes("국제")) {
    return "국제";
  }
  if (titleLower.includes("학사") || titleLower.includes("수업") || titleLower.includes("수강") || titleLower.includes("학적")) {
    return "학사";
  }

  // Default
  return "일반";
};

/**
 * Parses RSS XML and converts to Alert array
 */
const parseRSSToAlerts = (xmlText: string): Alert[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const items = xmlDoc.querySelectorAll("item");
  const alerts: Alert[] = [];

  items.forEach((item, index) => {
    const title = item.querySelector("title")?.textContent || "";
    const link = item.querySelector("link")?.textContent || "";
    const description = item.querySelector("description")?.textContent || "";
    const pubDate = item.querySelector("pubDate")?.textContent || "";
    const author = item.querySelector("author")?.textContent || "";

    // Convert pubDate to ISO string
    let publishedAt = new Date().toISOString();
    if (pubDate) {
      try {
        publishedAt = new Date(pubDate).toISOString();
      } catch {
        // Use current date if parsing fails
      }
    }

    const category = mapToAlertCategory(title, author);

    alerts.push({
      alertId: -(index + 1), // Negative IDs to distinguish from API data
      title,
      content: description,
      category,
      department: { id: 0, name: "" }, // Empty department for RSS data
      url: link,
      publishedAt,
      isRead: false,
    });
  });

  return alerts;
};

/**
 * Fetches alerts from RSS feed
 */
export const getAlertsFromRSS = async (): Promise<Alert[]> => {
  try {
    const response = await fetch(RSS_URL);
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xmlText = await response.text();
    return parseRSSToAlerts(xmlText);
  } catch (error) {
    console.error("Error fetching RSS:", error);
    throw error;
  }
};
