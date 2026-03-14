import type { GeneralAlert } from "../../types/api";

const CAREER_URL = "https://www.konkuk.ac.kr/combBbs/konkuk/2/list.do";

/**
 * Parses HTML table and converts to GeneralAlert array for 취창업 category
 */
const parseHTMLToAlerts = (
  htmlText: string,
  startId: number
): GeneralAlert[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  const alerts: GeneralAlert[] = [];

  // Find all table rows in tbody
  const rows = doc.querySelectorAll("table tbody tr");

  rows.forEach((row, index) => {
    const cells = row.querySelectorAll("td");

    if (cells.length < 5) {
      return; // Skip rows that don't have enough cells
    }

    // Extract data from cells
    // Cell structure: [번호, 제목, 작성자, 작성일, 조회수, 첨부파일]
    const titleCell = cells[1];
    const titleLink = titleCell.querySelector("a");
    const titleStrong = titleLink?.querySelector("strong");

    if (!titleStrong) {
      return; // Skip if no title found
    }

    const title = titleStrong.textContent?.trim() || "";
    const dateText = cells[3].textContent?.trim() || "";

    // Extract all 4 parameters from href="javascript:jf_combBbs_view('konkuk','2','4083','1161958');"
    // Parameters: siteId, boardId, bbsId, artclId
    const hrefAttr = titleLink?.getAttribute("href") || "";
    const viewMatch = hrefAttr.match(
      /jf_combBbs_view\('([^']+)','([^']+)','([^']+)','([^']+)'\)/
    );

    // Build URL with correct format: /combBbs/{siteId}/{boardId}/{bbsId}/{artclId}/view.do
    const url = viewMatch
      ? `https://www.konkuk.ac.kr/combBbs/${viewMatch[1]}/${viewMatch[2]}/${viewMatch[3]}/${viewMatch[4]}/view.do`
      : "";

    // Debug logging
    if (!url) {
      console.warn("Failed to parse URL from href:", hrefAttr, "Title:", title);
    }

    // Convert date to ISO string (format: YYYY.MM.DD)
    let publishedAt = new Date().toISOString();
    if (dateText) {
      try {
        // Convert "2025.11.19" to "2025-11-19"
        const isoDate = dateText.replace(/\./g, "-");
        publishedAt = new Date(isoDate).toISOString();
      } catch {
        // Use current date if parsing fails
      }
    }

    alerts.push({
      alertId: -(startId + index),
      title,
      content: "", // HTML page doesn't provide content in list view
      category: "취창업",
      url,
      publishedAt,
      isRead: false,
    });
  });

  return alerts;
};

/**
 * Fetches alerts from 취창업 HTML page
 */
export const getCareerAlertsFromHTML = async (
  startId: number = 3001
): Promise<GeneralAlert[]> => {
  try {
    console.log("Fetching career alerts from:", CAREER_URL);
    const response = await fetch(CAREER_URL);

    if (!response.ok) {
      throw new Error(`HTML fetch failed: ${response.status}`);
    }

    const htmlText = await response.text();
    const alerts = parseHTMLToAlerts(htmlText, startId);
    console.log(`Parsed ${alerts.length} career alerts, sample:`, alerts[0]);
    return alerts;
  } catch (error) {
    console.error("Error fetching career HTML:", error);
    return []; // Return empty array on error
  }
};
