import {
  BULLETIN_FALLBACK,
  BULLETIN_FALLBACK_YEAR,
  createBulletinInfo,
  type BulletinInfo,
} from "@/constants/bulletin";
import { debugLog } from "@/utils/logger";

type BulletinVerification = "verified" | "unverified";

interface BulletinCache {
  resolvedYear: number;
  attemptedYear: number;
  checkedAt: number;
}

const BULLETIN_CACHE_KEY = "linku:latest-bulletin:v1";

const RETRY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

const UNVERIFIED_PAGE_SIGNATURES = [
  "웹 공격 차단",
  "웹 방화벽",
  "비정상적인 접근",
  "access denied",
  "request blocked",
  "infra@konkuk.ac.kr",
  "source ip",
  "관리모드",
  "알림메세지",
  "존재하지 않는",
  "페이지를 찾을 수",
  "page not found",
];

let sessionResolution:
  | { calendarYear: number; promise: Promise<BulletinInfo> }
  | undefined;

const INITIAL_CACHE: BulletinCache = {
  resolvedYear: BULLETIN_FALLBACK_YEAR,
  attemptedYear: BULLETIN_FALLBACK_YEAR,
  checkedAt: 0,
};

function getStorage(): chrome.storage.StorageArea | null {
  return globalThis.chrome?.storage?.local ?? null;
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
    UNVERIFIED_PAGE_SIGNATURES.some((signature) =>
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

    if (
      response.status !== 200 ||
      !isExpectedBulletinPage(response.url, year)
    ) {
      return "unverified";
    }

    return verifyBulletinBody(await response.text(), year);
  } catch (error) {
    debugLog("[bulletin] Failed to check annual bulletin", error);
    return "unverified";
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function resolveLatestBulletinInternal(
  now: Date,
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
    debugLog("[bulletin] Failed to read bulletin cache", error);
    return BULLETIN_FALLBACK;
  }

  if (cache.resolvedYear >= currentYear) {
    return createBulletinInfo(cache.resolvedYear);
  }

  const checkedCurrentYearRecently =
    cache.attemptedYear === currentYear &&
    nowMs - cache.checkedAt < RETRY_INTERVAL_MS;

  if (checkedCurrentYearRecently) {
    return createBulletinInfo(cache.resolvedYear);
  }

  const candidateYears = [currentYear, currentYear - 1].filter(
    (year) => year > cache.resolvedYear,
  );

  let resolvedYear = cache.resolvedYear;
  for (const candidateYear of candidateYears) {
    const verification = await verifyBulletin(candidateYear);
    if (verification === "verified") {
      resolvedYear = candidateYear;
      break;
    }
  }

  const updatedCache: BulletinCache = {
    resolvedYear,
    attemptedYear: currentYear,
    checkedAt: nowMs,
  };

  try {
    await storage.set({ [BULLETIN_CACHE_KEY]: updatedCache });
  } catch (error) {
    debugLog("[bulletin] Failed to persist bulletin cache", error);
  }

  return createBulletinInfo(resolvedYear);
}

export function resolveLatestBulletin(
  now: Date = new Date(),
): Promise<BulletinInfo> {
  const calendarYear = now.getFullYear();

  if (!sessionResolution || sessionResolution.calendarYear !== calendarYear) {
    sessionResolution = {
      calendarYear,
      promise: resolveLatestBulletinInternal(now),
    };
  }

  return sessionResolution.promise;
}
