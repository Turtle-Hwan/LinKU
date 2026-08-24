import type {
  AlertCategory,
  GeneralAlert,
  RSSAlertCategory,
} from "@/types/api";
import { recordBreadcrumb } from "@/monitoring";
import { getErrorLogDetails, warnLogOnly } from "@/utils/logger";
import { isExpectedNetworkFailure } from "@/utils/networkFailure";
import {
  getAlertsFromRSSPage,
  RSS_ALERT_PAGE_SIZE,
} from "./external/rss-parser";
import {
  CAREER_ALERT_PAGE_SIZE,
  getCareerAlertsPage,
} from "./external/html-parser";

const PUBLIC_ALERT_SOURCES: AlertCategory[] = [
  "학사",
  "장학",
  "국제",
  "학생",
  "일반",
  "취창업",
];

const PUBLIC_ALERT_CACHE_TTL_MS = 10 * 60 * 1000;

const PUBLIC_ALERT_CACHE_KEY_PREFIX = "publicAlertCacheV1";
const SYNC_ANCHOR_COUNT = 10;
const MAX_CATCH_UP_PAGES = 100;
const MAX_CACHED_ALERTS_PER_SOURCE = 500;

interface CachedAlertSource {
  items: GeneralAlert[];
  fetchedAt: number;
  syncAnchorKeys: string[];
}

export type PublicAlertFailureKind =
  | "external_unavailable"
  | "sync_contract";

export interface PublicAlertSyncFailure {
  source: AlertCategory;
  kind: PublicAlertFailureKind;
  reason: unknown;
}

const EXTERNAL_HTTP_FAILURE_PATTERN =
  /^(?:RSS|HTML) fetch failed(?: for [^:]+)?: \d{3}$/u;

/** @internal Exported for focused regression tests. */
export const classifyPublicAlertFailure = (
  error: unknown,
): PublicAlertFailureKind => {
  if (isExpectedNetworkFailure(error)) {
    return "external_unavailable";
  }

  return error instanceof Error &&
    EXTERNAL_HTTP_FAILURE_PATTERN.test(error.message)
    ? "external_unavailable"
    : "sync_contract";
};

const isUsablePublicAlert = (
  alert: GeneralAlert,
  source: AlertCategory,
) => {
  if (
    alert.category !== source ||
    !Number.isFinite(alert.alertId) ||
    !alert.title.trim() ||
    !alert.url ||
    Number.isNaN(Date.parse(alert.publishedAt))
  ) {
    return false;
  }

  try {
    const url = new URL(alert.url);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const fetchPublicAlertPage = async (
  source: AlertCategory,
  page: number,
) => {
  const pageItems = source === "취창업"
    ? await getCareerAlertsPage(page)
    : await getAlertsFromRSSPage(source as RSSAlertCategory, page);
  const usableItems = pageItems.filter((alert) =>
    isUsablePublicAlert(alert, source)
  );
  const malformedCount = pageItems.length - usableItems.length;

  if (malformedCount > 0) {
    recordBreadcrumb("alerts.parse", "malformed public alerts skipped", {
      source,
      page,
      malformed_count: malformedCount,
    }, "warning");
    warnLogOnly(
      `[Alerts] Skipped ${malformedCount} malformed ${source} alerts`,
    );
  }

  // A successful first-page response with no usable notices is commonly a
  // WAF/login/error page returned with HTTP 200. Never replace a healthy cache
  // with that response.
  if (page === 1 && usableItems.length === 0) {
    throw new Error(`Alert source returned no usable items for ${source}`);
  }

  return usableItems;
};

const getPageSize = (source: AlertCategory) =>
  source === "취창업" ? CAREER_ALERT_PAGE_SIZE : RSS_ALERT_PAGE_SIZE;

const isCachedAlertSource = (value: unknown): value is CachedAlertSource => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CachedAlertSource>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.fetchedAt === "number" &&
    Array.isArray(candidate.syncAnchorKeys)
  );
};

const getSourceCacheKey = (source: AlertCategory) =>
  `${PUBLIC_ALERT_CACHE_KEY_PREFIX}:${source}`;

const readSourceCaches = async (sources: AlertCategory[]) => {
  const keys = sources.map(getSourceCacheKey);
  const stored = await chrome.storage.local.get(keys);

  return keys.map((key) => {
    const cached: unknown = stored[key];
    return isCachedAlertSource(cached) ? cached : undefined;
  });
};

const readSourceCache = async (source: AlertCategory) =>
  (await readSourceCaches([source]))[0];

const writeSourceCache = async (
  source: AlertCategory,
  value: CachedAlertSource,
) => chrome.storage.local.set({ [getSourceCacheKey(source)]: value });

const getPublicAlertKey = (alert: GeneralAlert) =>
  `${alert.category}:${alert.url || `${alert.alertId}:${alert.title}`}`;

const sortByPublishedAt = (alerts: GeneralAlert[]) =>
  [...alerts].sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime(),
  );

const mergeAlerts = (
  cached: GeneralAlert[],
  fetched: GeneralAlert[],
) => {
  const byKey = new Map<string, GeneralAlert>();

  cached.forEach((alert) => byKey.set(getPublicAlertKey(alert), alert));
  fetched.forEach((alert) => byKey.set(getPublicAlertKey(alert), alert));

  return sortByPublishedAt([...byKey.values()]).slice(
    0,
    MAX_CACHED_ALERTS_PER_SOURCE,
  );
};

const isFresh = (
  entry: CachedAlertSource | undefined,
  now: number,
): entry is CachedAlertSource =>
  Boolean(
    entry &&
      entry.fetchedAt > 0 &&
      now - entry.fetchedAt < PUBLIC_ALERT_CACHE_TTL_MS,
  );

const fingerprintsMatch = (
  left: GeneralAlert[],
  right: GeneralAlert[],
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (alert, index) =>
      getPublicAlertKey(alert) === getPublicAlertKey(right[index]),
  );
};

const synchronizeSource = async (
  source: AlertCategory,
  current: CachedAlertSource | undefined,
  verificationAttempt: number = 0,
): Promise<CachedAlertSource> => {
  const anchorKeys = new Set(current?.syncAnchorKeys || []);
  const fetched: GeneralAlert[] = [];
  const pageSize = getPageSize(source);
  let firstPage: GeneralAlert[] = [];
  let reachedPreviousBoundary = anchorKeys.size === 0;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_CATCH_UP_PAGES; page += 1) {
    const pageItems = await fetchPublicAlertPage(source, page);
    pagesFetched = page;

    if (page === 1) {
      firstPage = pageItems;
    }

    fetched.push(...pageItems);

    if (anchorKeys.size === 0) {
      break;
    }

    if (
      pageItems.some((alert) => anchorKeys.has(getPublicAlertKey(alert)))
    ) {
      reachedPreviousBoundary = true;
      break;
    }

    if (pageItems.length < pageSize) {
      reachedPreviousBoundary = true;
      break;
    }
  }

  if (!reachedPreviousBoundary) {
    throw new Error(`Alert sync boundary not found for ${source}`);
  }

  // Offset pagination can move while multiple pages are being read. Re-check
  // the head once and retry the crawl when it changed during synchronization.
  if (pagesFetched > 1) {
    const verifiedFirstPage = await fetchPublicAlertPage(source, 1);

    if (!fingerprintsMatch(firstPage, verifiedFirstPage)) {
      if (verificationAttempt < 1) {
        return synchronizeSource(
          source,
          current,
          verificationAttempt + 1,
        );
      }

      throw new Error(`Alert feed changed during sync for ${source}`);
    }
  }

  const mergedItems = mergeAlerts(current?.items || [], fetched);
  const anchorStart = Math.max(0, firstPage.length - SYNC_ANCHOR_COUNT);

  return {
    items: mergedItems,
    fetchedAt: Date.now(),
    syncAnchorKeys: firstPage
      .slice(anchorStart)
      .map(getPublicAlertKey),
  };
};

const sourceSyncs = new Map<AlertCategory, Promise<CachedAlertSource>>();

const syncPublicAlertSource = async (source: AlertCategory) => {
  const activeSync = sourceSyncs.get(source);
  if (activeSync) {
    return activeSync;
  }

  const sync = (async () => {
    const current = await readSourceCache(source);

    if (isFresh(current, Date.now())) {
      return current;
    }

    const next = await synchronizeSource(source, current);
    await writeSourceCache(source, next);
    return next;
  })();

  sourceSyncs.set(source, sync);

  try {
    return await sync;
  } finally {
    sourceSyncs.delete(source);
  }
};

export const getCachedPublicAlerts = async (
  category?: AlertCategory,
): Promise<GeneralAlert[]> => {
  const sources = category ? [category] : PUBLIC_ALERT_SOURCES;
  const cachedSources = await readSourceCaches(sources);

  return sortByPublishedAt(
    cachedSources.flatMap((cached) => cached?.items || []),
  );
};

export const syncPublicAlerts = async (
  category?: AlertCategory,
) => {
  const sources = category ? [category] : PUBLIC_ALERT_SOURCES;
  const results = await Promise.allSettled(
    sources.map(syncPublicAlertSource),
  );

  const failures = results.flatMap<PublicAlertSyncFailure>((result, index) => {
    if (result.status !== "rejected") {
      return [];
    }

    const source = sources[index];
    if (!source) {
      return [];
    }
    const kind = classifyPublicAlertFailure(result.reason);
    recordBreadcrumb("alerts.sync", "public alert source refresh failed", {
      source,
      failure_kind: kind,
      error: getErrorLogDetails(result.reason),
    }, "warning");
    warnLogOnly(
      `[Alerts] Failed to refresh ${source} alert cache`,
      getErrorLogDetails(result.reason),
    );

    return [{ source, kind, reason: result.reason }];
  });

  const alerts = await getCachedPublicAlerts(category);
  const allFailed = results.every((result) => result.status === "rejected");

  return {
    alerts,
    allFailed,
    failures,
  };
};
