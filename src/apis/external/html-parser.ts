import type { GeneralAlert } from "../../types/api";
import { recordBreadcrumb } from "@/monitoring";
import { warnLog } from "@/utils/logger";

const CAREER_URL = "https://www.konkuk.ac.kr/combBbs/konkuk/2/list.do";

export const CAREER_ALERT_PAGE_SIZE = 20;

/**
 * Parses HTML table and converts to GeneralAlert array for 취창업 category
 */
const parseHTMLToAlerts = (
  htmlText: string,
): GeneralAlert[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  const alerts: GeneralAlert[] = [];
  let skippedRowCount = 0;

  // Find all table rows in tbody
  const rows = doc.querySelectorAll("table tbody tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    if (cells.length < 5) {
      skippedRowCount += 1;
      return; // Skip rows that don't have enough cells
    }

    // Extract data from cells
    // Cell structure: [번호, 제목, 작성자, 작성일, 조회수, 첨부파일]
    const titleCell = cells[1];
    const titleLink = titleCell.querySelector("a");
    const titleStrong = titleLink?.querySelector("strong");

    if (!titleStrong) {
      skippedRowCount += 1;
      return; // Skip if no title found
    }

    const title = titleStrong.textContent?.trim() || "";
    const dateText = cells[3].textContent?.trim() || "";

    // Extract all 4 parameters from href="javascript:jf_combBbs_view('konkuk','2','4083','1161958');"
    // Parameters: siteId, boardId, bbsId, artclId
    const hrefAttr = titleLink?.getAttribute("href") || "";
    const viewMatch = hrefAttr.match(
      /jf_combBbs_view\('([^']+)','(\d+)','(\d+)','(\d+)'\)/
    );

    if (!title || !viewMatch) {
      skippedRowCount += 1;
      return;
    }

    // Build URL with correct format: /combBbs/{siteId}/{boardId}/{bbsId}/{artclId}/view.do
    const url = `https://www.konkuk.ac.kr/combBbs/${viewMatch[1]}/${viewMatch[2]}/${viewMatch[3]}/${viewMatch[4]}/view.do`;

    // Invalid dates must not be replaced with "now": doing so promotes a
    // malformed row to the top of the cache as if it were a new notice.
    const publishedTimestamp = Date.parse(dateText.replace(/\./g, "-"));
    if (!dateText || Number.isNaN(publishedTimestamp)) {
      skippedRowCount += 1;
      return;
    }
    const publishedAt = new Date(publishedTimestamp).toISOString();

    alerts.push({
      // artclId remains stable when rows move between list pages.
      alertId: -Number(viewMatch[4]),
      title,
      content: "", // HTML page doesn't provide content in list view
      category: "취창업",
      url,
      publishedAt,
      isRead: false,
    });
  });

  if (skippedRowCount > 0) {
    recordBreadcrumb("alerts.parse", "malformed career alert rows skipped", {
      skipped_row_count: skippedRowCount,
      parsed_row_count: alerts.length,
    }, "warning");
    warnLog(
      `[Alerts] Skipped ${skippedRowCount} malformed career alert rows`,
    );
  }

  return alerts;
};

/**
 * Fetches alerts from 취창업 HTML page
 */
export const getCareerAlertsPage = async (
  page: number,
): Promise<GeneralAlert[]> => {
  const url = new URL(CAREER_URL);
  url.searchParams.set("page", String(page));
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTML fetch failed: ${response.status}`);
  }

  const htmlText = await response.text();
  return parseHTMLToAlerts(htmlText);
};
