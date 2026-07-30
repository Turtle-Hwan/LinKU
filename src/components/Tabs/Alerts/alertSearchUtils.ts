import type { Alert } from "@/types/api";

const normalizeSearchText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("ko-KR");

export const matchesAlertQuery = (alert: Alert, query: string) => {
  const queryTokens = normalizeSearchText(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (queryTokens.length === 0) {
    return true;
  }

  const sourceName =
    "department" in alert ? alert.department.name : alert.category;
  const searchableText = normalizeSearchText(
    [alert.title, alert.content, sourceName].filter(Boolean).join(" ")
  );

  return queryTokens.every((token) => searchableText.includes(token));
};
