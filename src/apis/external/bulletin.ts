import {
  BULLETIN_FALLBACK,
  BULLETIN_FALLBACK_YEAR,
  createBulletinInfo,
  type BulletinInfo,
} from "@/constants/bulletin";
import { recordBreadcrumb } from "@/monitoring";
import { errorLog, warnLogOnly } from "@/utils/logger";
import {
  classifyNetworkFailure,
  isExpectedNetworkFailure,
} from "@/utils/networkFailure";

type BulletinVerification = "verified" | "unverified" | "unreachable";
type BulletinListener = (bulletin: BulletinInfo) => void;

interface BulletinCache {
  resolvedYear: number;
  attemptedYear: number;
  checkedAt: number;
}

const BULLETIN_CACHE_KEY = "linku:latest-bulletin:v1";

const RETRY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

const UNREACHABLE_PAGE_SIGNATURES = [
  "웹 공격 차단",
  "웹 방화벽",
  "비정상적인 접근",
  "access denied",
  "request blocked",
  "infra@konkuk.ac.kr",
  "source ip",
  "관리모드",
  "알림메세지",
];

const MISSING_PAGE_SIGNATURES = [
  "존재하지 않는",
  "페이지를 찾을 수",
  "page not found",
];

let sessionRefresh:
  | { calendarYear: number; promise: Promise<void> }
  | undefined;
const bulletinListeners = new Set<BulletinListener>();

const INITIAL_CACHE: BulletinCache = {
  resolvedYear: BULLETIN_FALLBACK_YEAR,
  attemptedYear: BULLETIN_FALLBACK_YEAR,
  checkedAt: 0,
};

function getStorage(): chrome.storage.StorageArea | null {
  return globalThis.chrome?.storage?.local ?? null;
}

function notifyBulletinListeners(bulletin: BulletinInfo): void {
  bulletinListeners.forEach((listener) => listener(bulletin));
}

export function subscribeLatestBulletin(
  listener: BulletinListener,
): () => void {
  bulletinListeners.add(listener);
  return () => bulletinListeners.delete(listener);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isYearInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function parseCache(
  value: unknown,
  currentYear: number,
  nowMs: number,
): BulletinCache {
  if (!isRecord(value)) {
    return INITIAL_CACHE;
  }

  const resolvedYear = isYearInRange(
    value.resolvedYear,
    BULLETIN_FALLBACK_YEAR,
    currentYear,
  )
    ? value.resolvedYear
    : BULLETIN_FALLBACK_YEAR;

  const attemptedYear = isYearInRange(
    value.attemptedYear,
    resolvedYear,
    currentYear,
  )
    ? value.attemptedYear
    : resolvedYear;

  const checkedAt =
    typeof value.checkedAt === "number" &&
    Number.isFinite(value.checkedAt) &&
    value.checkedAt >= 0 &&
    value.checkedAt <= nowMs
      ? value.checkedAt
      : 0;

  return { resolvedYear, attemptedYear, checkedAt };
}

function isExpectedBulletinPage(responseUrl: string, year: number): boolean {
  try {
    const finalUrl = new URL(responseUrl);
    const expectedUrl = new URL(createBulletinInfo(year).url);
    const expectedPaths = [
      expectedUrl.pathname,
      `/sites${expectedUrl.pathname}`,
    ];

    return (
      finalUrl.hostname === expectedUrl.hostname &&
      expectedPaths.includes(finalUrl.pathname)
    );
  } catch {
    return false;
  }
}

function verifyBulletinBody(
  body: string,
  year: number,
): BulletinVerification {
  const normalizedBody = body.toLowerCase();

  if (
    UNREACHABLE_PAGE_SIGNATURES.some((signature) =>
      normalizedBody.includes(signature),
    )
  ) {
    return "unreachable";
  }

  if (
    MISSING_PAGE_SIGNATURES.some((signature) =>
      normalizedBody.includes(signature),
    )
  ) {
    return "unverified";
  }

  const visibleText = normalizedBody
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const handbookHeading = new RegExp(
    `${year}(?:학년도)?\\s+건국대학교\\s+(?:온라인\\s*)?요람`,
  );

  return handbookHeading.test(visibleText)
    ? "verified"
    : "unverified";
}

async function verifyBulletin(
  year: number,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<BulletinVerification> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    // An SSO redirect alone does not prove that the annual site exists.
    // Follow the authenticated chain and validate the final handbook HTML.
    const response = await fetchImpl(createBulletinInfo(year).url, {
      method: "GET",
      redirect: "follow",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404 || response.status === 410) {
      return "unverified";
    }

    if (response.status !== 200) {
      recordBreadcrumb(
        "bulletin.http",
        "annual bulletin endpoint unavailable",
        { status: response.status, year },
        "warning",
      );
      warnLogOnly("[bulletin] Annual bulletin endpoint unavailable", {
        status: response.status,
        year,
      });
      return "unreachable";
    }

    if (!isExpectedBulletinPage(response.url, year)) {
      recordBreadcrumb(
        "bulletin.redirect",
        "annual bulletin verification ended on an unexpected page",
        { year },
        "warning",
      );
      return "unreachable";
    }

    const verification = verifyBulletinBody(await response.text(), year);
    if (verification === "unreachable") {
      recordBreadcrumb(
        "bulletin.page",
        "annual bulletin page was blocked or unavailable",
        { year },
        "warning",
      );
    }
    return verification;
  } catch (error) {
    const networkFailureKind = classifyNetworkFailure(error);
    recordBreadcrumb(
      "bulletin.network",
      "annual bulletin verification failed",
      { network_failure_kind: networkFailureKind, year },
      "warning",
    );

    if (isExpectedNetworkFailure(error)) {
      warnLogOnly("[bulletin] Failed to check annual bulletin", error);
    } else {
      errorLog("[bulletin] Failed to check annual bulletin", error);
    }
    return "unreachable";
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function shouldRefreshBulletin(
  cache: BulletinCache,
  currentYear: number,
  nowMs: number,
): boolean {
  if (cache.resolvedYear >= currentYear) {
    return false;
  }

  return !(
    cache.attemptedYear === currentYear &&
    nowMs - cache.checkedAt < RETRY_INTERVAL_MS
  );
}

async function refreshLatestBulletin(
  storage: chrome.storage.StorageArea,
  cache: BulletinCache,
  currentYear: number,
  nowMs: number,
): Promise<void> {
  const candidateYears = [currentYear, currentYear - 1].filter(
    (year) => year > cache.resolvedYear,
  );
  const results = await Promise.all(
    candidateYears.map(async (year) => ({
      year,
      verification: await verifyBulletin(year),
    })),
  );
  const verifiedCandidate = results.find(
    ({ verification }) => verification === "verified",
  );
  const resolvedYear = verifiedCandidate?.year ?? cache.resolvedYear;
  const hasUnreachableCandidate = results.some(
    ({ verification }) => verification === "unreachable",
  );
  const updatedCache: BulletinCache = hasUnreachableCandidate
    ? {
        resolvedYear,
        attemptedYear: Math.max(cache.attemptedYear, resolvedYear),
        checkedAt: cache.checkedAt,
      }
    : {
        resolvedYear,
        attemptedYear: currentYear,
        checkedAt: nowMs,
      };

  // A blocked, offline, timed-out, or unavailable request says nothing about
  // whether the year's handbook exists. Do not turn it into a seven-day miss.
  if (!hasUnreachableCandidate || resolvedYear > cache.resolvedYear) {
    try {
      await storage.set({ [BULLETIN_CACHE_KEY]: updatedCache });
    } catch (error) {
      errorLog("[bulletin] Failed to persist bulletin cache", error);
    }
  }

  if (resolvedYear > cache.resolvedYear) {
    notifyBulletinListeners(createBulletinInfo(resolvedYear));
  }
}

function startBulletinRefresh(
  storage: chrome.storage.StorageArea,
  cache: BulletinCache,
  currentYear: number,
  nowMs: number,
): void {
  if (sessionRefresh?.calendarYear === currentYear) {
    return;
  }

  const promise = refreshLatestBulletin(
    storage,
    cache,
    currentYear,
    nowMs,
  ).catch((error) => {
    errorLog("[bulletin] Failed to refresh annual bulletin", error);
  });
  sessionRefresh = { calendarYear: currentYear, promise };
}

export async function resolveLatestBulletin(
  now: Date = new Date(),
): Promise<BulletinInfo> {
  const storage = getStorage();
  const currentYear = now.getFullYear();
  const nowMs = now.getTime();

  if (
    !storage ||
    !Number.isInteger(currentYear) ||
    !Number.isFinite(nowMs) ||
    currentYear <= BULLETIN_FALLBACK_YEAR
  ) {
    return BULLETIN_FALLBACK;
  }

  let cache: BulletinCache;
  try {
    const stored = await storage.get(BULLETIN_CACHE_KEY);
    cache = parseCache(stored[BULLETIN_CACHE_KEY], currentYear, nowMs);
  } catch (error) {
    errorLog("[bulletin] Failed to read bulletin cache", error);
    return BULLETIN_FALLBACK;
  }

  if (shouldRefreshBulletin(cache, currentYear, nowMs)) {
    startBulletinRefresh(storage, cache, currentYear, nowMs);
  }

  return createBulletinInfo(cache.resolvedYear);
}
