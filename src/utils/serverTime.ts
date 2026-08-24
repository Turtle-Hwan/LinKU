import {
  classifyNetworkFailure,
  type NetworkFailureKind,
} from "./networkFailure.ts";

export type ServerTimeSyncFailureKind =
  | Exclude<NetworkFailureKind, "unknown">
  | "invalid_url"
  | "missing_date"
  | "invalid_date"
  | "unexpected";

export interface ServerTimeSample {
  offset: number;
  rtt: number;
  lastSyncMs: number;
}

interface ServerTimeResponse {
  headers: {
    get(name: string): string | null;
  };
}

export type ServerTimeFetch = (
  input: string,
  init: RequestInit,
) => Promise<ServerTimeResponse>;

export class ExpectedServerTimeSyncError extends Error {
  readonly kind: Extract<
    ServerTimeSyncFailureKind,
    "invalid_url" | "missing_date" | "invalid_date"
  >;

  constructor(
    kind: ExpectedServerTimeSyncError["kind"],
    message: string,
  ) {
    super(message);
    this.name = "ExpectedServerTimeSyncError";
    this.kind = kind;
  }
}

export function resolveServerTimeUrl(serverUrl: string): string {
  try {
    const url = new URL(serverUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new ExpectedServerTimeSyncError(
      "invalid_url",
      "올바른 서버 URL이 아닙니다",
    );
  }
}

export function parseServerDateHeader(dateHeader: string | null): number {
  if (!dateHeader) {
    throw new ExpectedServerTimeSyncError(
      "missing_date",
      "서버에서 Date 헤더를 받을 수 없습니다",
    );
  }

  const serverTime = Date.parse(dateHeader);
  if (!Number.isFinite(serverTime)) {
    throw new ExpectedServerTimeSyncError(
      "invalid_date",
      "서버 Date 헤더 형식이 올바르지 않습니다",
    );
  }

  return serverTime;
}

export function classifyServerTimeSyncFailure(
  error: unknown,
  online: boolean | undefined = globalThis.navigator?.onLine,
): ServerTimeSyncFailureKind {
  if (error instanceof ExpectedServerTimeSyncError) {
    return error.kind;
  }

  const networkFailureKind = classifyNetworkFailure(error, online);
  return networkFailureKind === "unknown"
    ? "unexpected"
    : networkFailureKind;
}

export function getServerTimeSyncErrorMessage(
  kind: ServerTimeSyncFailureKind,
  error: unknown,
): string {
  switch (kind) {
    case "offline":
      return "오프라인 상태에서는 동기화할 수 없습니다";
    case "blocked_or_unreachable":
      return "서버에 연결할 수 없습니다";
    case "aborted":
      return "서버 응답 시간이 초과되었거나 동기화가 취소되었습니다";
    case "invalid_url":
    case "missing_date":
    case "invalid_date":
      return error instanceof Error ? error.message : "동기화 실패";
    case "unexpected":
      return "서버 시간을 동기화하지 못했습니다";
  }
}

export async function requestServerTimeSample(
  serverUrl: string,
  signal: AbortSignal,
  fetchImpl: ServerTimeFetch = fetch,
  now: () => number = Date.now,
): Promise<ServerTimeSample> {
  const resolvedUrl = resolveServerTimeUrl(serverUrl);
  const t0 = now();
  const response = await fetchImpl(resolvedUrl, {
    method: "HEAD",
    cache: "no-store",
    signal,
  });
  const t3 = now();
  const serverTime = parseServerDateHeader(response.headers.get("Date"));
  const rtt = t3 - t0;
  const midpoint = t0 + rtt / 2;

  return {
    offset: serverTime - midpoint,
    rtt,
    lastSyncMs: t3,
  };
}
