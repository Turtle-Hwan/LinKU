import {
  BULLETIN_FALLBACK,
  BULLETIN_FALLBACK_YEAR,
  createBulletinInfo,
  type BulletinInfo,
} from "@/constants/bulletin";
import { debugLog } from "@/utils/logger";

export type BulletinAvailability = "available" | "unavailable" | "unknown";

interface BulletinCache {
  resolvedYear: number;
  attemptedYear: number;
  checkedAt: number;
}

export const BULLETIN_CACHE_KEY = "linku:latest-bulletin:v1";

const RETRY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

const WAF_SIGNATURES = [
  "웹 공격 차단",
  "비정상적인 접근",
  "access denied",
  "request blocked",
];

const ERROR_PAGE_SIGNATURES = [
  "관리모드",
  "알림메세지",
  "존재하지 않는",
  "페이지를 찾을 수",
  "page not found",
];

let sessionResolution:
  | { calendarYear: number; promise: Promise<BulletinInfo> }
  | undefined;

function getStorage(): chrome.storage.StorageArea | null {
  return globalThis.chrome?.storage?.local ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createInitialCache(): BulletinCache {
  return {
    resolvedYear: BULLETIN_FALLBACK_YEAR,
    attemptedYear: BULLETIN_FALLBACK_YEAR,
    checkedAt: 0,
  };
}

function parseCache(
  value: unknown,
  currentYear: number,
  nowMs: number,
): BulletinCache {
  if (!isRecord(value)) {
    return createInitialCache();
  }

  const resolvedYear =
    Number.isInteger(value.resolvedYear) &&
    Number(value.resolvedYear) >= BULLETIN_FALLBACK_YEAR &&
    Number(value.resolvedYear) <= currentYear
      ? Number(value.resolvedYear)
      : BULLETIN_FALLBACK_YEAR;

  const attemptedYear =
    Number.isInteger(value.attemptedYear) &&
    Number(value.attemptedYear) >= resolvedYear &&
    Number(value.attemptedYear) <= currentYear
      ? Number(value.attemptedYear)
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

function isExpectedSsoRedirect(location: string, year: number): boolean {
  try {
    const redirectUrl = new URL(
      location,
      createBulletinInfo(year).url,
    );

    if (redirectUrl.hostname !== "sso.konkuk.ac.kr") {
      return false;
    }

    const relayState = redirectUrl.searchParams.get("RelayState");
    if (!relayState) {
      return false;
    }

    const relayUrl = new URL(relayState);
    const expectedPath = new URL(createBulletinInfo(year).url).pathname;

    return (
      relayUrl.hostname === "www.konkuk.ac.kr" &&
      relayUrl.pathname === expectedPath
    );
  } catch {
    return false;
  }
}

function classifySuccessfulResponse(body: string, year: number): BulletinAvailability {
  const normalizedBody = body.toLowerCase();

  if (WAF_SIGNATURES.some((signature) => normalizedBody.includes(signature))) {
    return "unknown";
  }

  if (
    ERROR_PAGE_SIGNATURES.some((signature) =>
      normalizedBody.includes(signature),
    )
  ) {
    return "unavailable";
  }

  const shortYear = String(year).slice(-2);
  const hasBulletinSignature =
    normalizedBody.includes("요람") || normalizedBody.includes("bulletin");
  const hasYearSignature =
    normalizedBody.includes(String(year)) ||
    normalizedBody.includes(`bulletins${shortYear}`) ||
    normalizedBody.includes(`bulletin${shortYear}`);

  return hasBulletinSignature && hasYearSignature
    ? "available"
    : "unknown";
}

export async function checkBulletinAvailability(
  year: number,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<BulletinAvailability> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(createBulletinInfo(year).url, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.type === "opaqueredirect") {
      return "available";
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      return !location || isExpectedSsoRedirect(location, year)
        ? "available"
        : "unknown";
    }

    if (response.status === 404 || response.status === 410) {
      return "unavailable";
    }

    if (response.status !== 200) {
      return "unknown";
    }

    return classifySuccessfulResponse(await response.text(), year);
  } catch (error) {
    debugLog("[bulletin] Failed to check annual bulletin", error);
    return "unknown";
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
    (year, index, years) =>
      year > cache.resolvedYear && years.indexOf(year) === index,
  );

  let resolvedYear = cache.resolvedYear;
  for (const candidateYear of candidateYears) {
    const availability = await checkBulletinAvailability(candidateYear);
    if (availability === "available") {
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
