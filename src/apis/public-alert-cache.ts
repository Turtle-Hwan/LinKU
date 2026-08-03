import type {
  AlertCategory,
  GeneralAlert,
  RSSAlertCategory,
} from "@/types/api";
import { getStorage, setStorage } from "@/utils/chrome";
import { warnLog } from "@/utils/logger";
import {
  getAlertsFromRSSPage,
  RSS_ALERT_PAGE_SIZE,
} from "./external/rss-parser";
import {
  CAREER_ALERT_PAGE_SIZE,
  getCareerAlertsPage,
} from "./external/html-parser";

export const PUBLIC_ALERT_SOURCES: AlertCategory[] = [
  "학사",
  "장학",
  "국제",
  "학생",
  "일반",
  "취창업",
];

export const PUBLIC_ALERT_CACHE_TTL_MS = 10 * 60 * 1000;

const PUBLIC_ALERT_CACHE_KEY = "publicAlertCacheV1";
const PUBLIC_ALERT_CACHE_VERSION = 1;
const SYNC_ANCHOR_COUNT = 10;
const MAX_CATCH_UP_PAGES = 100;

interface CachedAlertSource {
  items: GeneralAlert[];
  fetchedAt: number;
  syncAnchorKeys: string[];
  fullyBackfilled: boolean;
}

interface PublicAlertCache {
  version: typeof PUBLIC_ALERT_CACHE_VERSION;
  sources: Partial<Record<AlertCategory, CachedAlertSource>>;
}

export interface PublicAlertSourceGateway {
  fetchPage: (
    source: AlertCategory,
    page: number,
  ) => Promise<GeneralAlert[]>;
  getPageSize: (source: AlertCategory) => number;
}

const schoolPublicAlertGateway: PublicAlertSourceGateway = {
  fetchPage: (source, page) => {
    if (source === "취창업") {
      return getCareerAlertsPage(page);
    }

    return getAlertsFromRSSPage(source as RSSAlertCategory, page);
  },
  getPageSize: (source) =>
    source === "취창업"
      ? CAREER_ALERT_PAGE_SIZE
      : RSS_ALERT_PAGE_SIZE,
};

const emptyCache = (): PublicAlertCache => ({
  version: PUBLIC_ALERT_CACHE_VERSION,
  sources: {},
});

const isPublicAlertCache = (value: unknown): value is PublicAlertCache => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PublicAlertCache>;
  return (
    candidate.version === PUBLIC_ALERT_CACHE_VERSION &&
    Boolean(candidate.sources) &&
    typeof candidate.sources === "object"
  );
};

const readCache = async (): Promise<PublicAlertCache> => {
  const cached = await getStorage<unknown>(PUBLIC_ALERT_CACHE_KEY);
  return isPublicAlertCache(cached) ? cached : emptyCache();
};

let cacheWriteQueue: Promise<void> = Promise.resolve();

const writeSourceCache = async (
  source: AlertCategory,
  value: CachedAlertSource,
) => {
  const write = cacheWriteQueue.then(async () => {
    const cache = await readCache();
    cache.sources[source] = value;
    await setStorage({ [PUBLIC_ALERT_CACHE_KEY]: cache });
  });

  cacheWriteQueue = write.catch(() => undefined);
  await write;
};

const getArticleIdFromUrl = (url?: string) =>
  url?.match(/\/(\d+)\/(?:artclView|view)\.do/)?.[1];

export const getPublicAlertKey = (alert: GeneralAlert) => {
  const articleId = getArticleIdFromUrl(alert.url);
  const fallback = alert.url || `${alert.alertId}:${alert.title}`;
  return `${alert.category}:${articleId || fallback}`;
};

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

  return sortByPublishedAt([...byKey.values()]);
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
  gateway: PublicAlertSourceGateway,
  verificationAttempt: number = 0,
): Promise<CachedAlertSource> => {
  const anchorKeys = new Set(current?.syncAnchorKeys || []);
  const fetched: GeneralAlert[] = [];
  const pageSize = gateway.getPageSize(source);
  let firstPage: GeneralAlert[] = [];
  let anchorFound = anchorKeys.size === 0;
  let exhausted = false;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_CATCH_UP_PAGES; page += 1) {
    const pageItems = await gateway.fetchPage(source, page);
    pagesFetched = page;

    if (page === 1) {
      firstPage = pageItems;
    }

    fetched.push(...pageItems);

    if (anchorKeys.size === 0) {
      exhausted = pageItems.length < pageSize;
      break;
    }

    if (
      pageItems.some((alert) => anchorKeys.has(getPublicAlertKey(alert)))
    ) {
      anchorFound = true;
      break;
    }

    if (pageItems.length < pageSize) {
      exhausted = true;
      break;
    }
  }

  if (anchorKeys.size > 0 && !anchorFound && !exhausted) {
    throw new Error(`Alert sync boundary not found for ${source}`);
  }

  // Offset pagination can move while multiple pages are being read. Re-check
  // the head once and retry the crawl when it changed during synchronization.
  if (pagesFetched > 1) {
    const verifiedFirstPage = await gateway.fetchPage(source, 1);

    if (!fingerprintsMatch(firstPage, verifiedFirstPage)) {
      if (verificationAttempt < 1) {
        return synchronizeSource(
          source,
          current,
          gateway,
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
    fullyBackfilled:
      current?.fullyBackfilled ||
      (anchorKeys.size > 0 && !anchorFound && exhausted) ||
      (anchorKeys.size === 0 && exhausted),
  };
};

const sourceSyncs = new Map<AlertCategory, Promise<CachedAlertSource>>();

export const syncPublicAlertSource = async (
  source: AlertCategory,
  options: {
    force?: boolean;
    gateway?: PublicAlertSourceGateway;
  } = {},
) => {
  const activeSync = sourceSyncs.get(source);
  if (activeSync) {
    return activeSync;
  }

  const sync = (async () => {
    const cache = await readCache();
    const current = cache.sources[source];

    if (!options.force && isFresh(current, Date.now())) {
      return current;
    }

    const next = await synchronizeSource(
      source,
      current,
      options.gateway || schoolPublicAlertGateway,
    );
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
  const cache = await readCache();
  const sources = category ? [category] : PUBLIC_ALERT_SOURCES;

  return sortByPublishedAt(
    sources.flatMap((source) => cache.sources[source]?.items || []),
  );
};

export const syncPublicAlerts = async (
  category?: AlertCategory,
  options: { gateway?: PublicAlertSourceGateway } = {},
) => {
  const sources = category ? [category] : PUBLIC_ALERT_SOURCES;
  const results = await Promise.allSettled(
    sources.map((source) =>
      syncPublicAlertSource(source, { gateway: options.gateway }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      warnLog(`Failed to refresh ${sources[index]} alert cache`, result.reason);
    }
  });

  const alerts = await getCachedPublicAlerts(category);
  const allFailed = results.every((result) => result.status === "rejected");

  return {
    alerts,
    allFailed,
  };
};
