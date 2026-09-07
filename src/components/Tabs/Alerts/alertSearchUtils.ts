import type { Alert } from "@/types/api";

const normalizeSearchText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("ko-KR");

const getSearchTokens = (query: string) =>
  normalizeSearchText(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const matchesAlertQuery = (alert: Alert, query: string) => {
  const queryTokens = getSearchTokens(query);

  if (queryTokens.length === 0) {
    return true;
  }

  const searchableText = normalizeSearchText(
    [alert.title, alert.content, alert.category].filter(Boolean).join(" ")
  );

  return queryTokens.every((token) => searchableText.includes(token));
};

interface HighlightRange {
  start: number;
  end: number;
}

export const getHighlightRanges = (
  text: string,
  query: string
): HighlightRange[] => {
  const normalizedText = normalizeSearchText(text);
  const ranges: HighlightRange[] = [];

  for (const token of getSearchTokens(query)) {
    let searchStart = 0;

    while (searchStart < normalizedText.length) {
      const matchStart = normalizedText.indexOf(token, searchStart);
      if (matchStart === -1) break;

      ranges.push({
        start: matchStart,
        end: matchStart + token.length,
      });
      searchStart = matchStart + token.length;
    }
  }

  return ranges
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce<HighlightRange[]>((merged, range) => {
      const previous = merged[merged.length - 1];

      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ ...range });
      }

      return merged;
    }, []);
};
