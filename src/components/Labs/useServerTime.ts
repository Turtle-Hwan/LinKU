import { useCallback, useEffect, useRef, useState } from "react";
import { recordBreadcrumb } from "@/monitoring";
import { errorLog, warnLogOnly } from "@/utils/logger";
import {
  classifyServerTimeSyncFailure,
  getServerTimeSyncErrorMessage,
  requestServerTimeSample,
} from "@/utils/serverTime";

interface ServerTimeState {
  serverTime: Date | null;
  offset: number;
  rtt: number;
  lastSync: Date | null;
  isLoading: boolean;
  error: string | null;
}

interface UseServerTimeReturn extends ServerTimeState {
  refresh: () => Promise<void>;
}

const SYNC_INTERVAL_MS = 30_000;
const SYNC_TIMEOUT_MS = 10_000;

interface SyncFlight {
  serverUrl: string;
  controller: AbortController;
  promise: Promise<void>;
}

function getServerOrigin(serverUrl: string): string | undefined {
  try {
    return new URL(serverUrl).origin;
  } catch {
    return undefined;
  }
}

export function useServerTime(serverUrl: string): UseServerTimeReturn {
  const [state, setState] = useState<ServerTimeState>({
    serverTime: null,
    offset: 0,
    rtt: 0,
    lastSync: null,
    isLoading: true,
    error: null,
  });

  const offsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef<SyncFlight | null>(null);
  const activeUrlRef = useRef<string | null>(serverUrl);
  const reportedUnexpectedUrlsRef = useRef(new Set<string>());

  const syncTime = useCallback(async (): Promise<void> => {
    while (inFlightRef.current) {
      const currentFlight = inFlightRef.current;
      if (
        currentFlight.serverUrl === serverUrl &&
        !currentFlight.controller.signal.aborted
      ) {
        return currentFlight.promise;
      }

      currentFlight.controller.abort();
      await currentFlight.promise;
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(
      () => controller.abort(),
      SYNC_TIMEOUT_MS,
    );
    const flightPromise = (async () => {
      try {
        const sample = await requestServerTimeSample(
          serverUrl,
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          activeUrlRef.current !== serverUrl
        ) {
          return;
        }

        offsetRef.current = sample.offset;
        setState((prev) => ({
          ...prev,
          offset: sample.offset,
          rtt: sample.rtt,
          lastSync: new Date(sample.lastSyncMs),
          isLoading: false,
          error: null,
        }));
      } catch (error) {
        const failureKind = classifyServerTimeSyncFailure(error);
        recordBreadcrumb(
          "labs.server_clock",
          "server time synchronization failed",
          {
            failure_kind: failureKind,
            server_origin: getServerOrigin(serverUrl),
          },
          failureKind === "unexpected" ? "error" : "warning",
        );

        if (failureKind === "unexpected") {
          if (!reportedUnexpectedUrlsRef.current.has(serverUrl)) {
            reportedUnexpectedUrlsRef.current.add(serverUrl);
            errorLog("[ServerClock] Sync error", error);
          }
        } else {
          warnLogOnly("[ServerClock] Sync skipped", error);
        }

        if (
          controller.signal.aborted ||
          activeUrlRef.current !== serverUrl
        ) {
          return;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: getServerTimeSyncErrorMessage(failureKind, error),
        }));
      } finally {
        globalThis.clearTimeout(timeoutId);
        if (inFlightRef.current?.controller === controller) {
          inFlightRef.current = null;
        }
      }
    })();

    inFlightRef.current = {
      serverUrl,
      controller,
      promise: flightPromise,
    };
    return flightPromise;
  }, [serverUrl]);

  // 실시간 시간 업데이트 (requestAnimationFrame 사용)
  const updateTime = useCallback(() => {
    const now = Date.now() + offsetRef.current;
    setState((prev) => ({
      ...prev,
      serverTime: new Date(now),
    }));
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, []);

  // 수동 새로고침
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    await syncTime();
  }, [syncTime]);

  // 초기화 및 정리 (serverUrl 변경 시 재시작)
  useEffect(() => {
    activeUrlRef.current = serverUrl;
    setState({
      serverTime: null,
      offset: 0,
      rtt: 0,
      lastSync: null,
      isLoading: true,
      error: null,
    });
    offsetRef.current = 0;

    void syncTime();

    // 실시간 시간 업데이트 시작
    animationFrameRef.current = requestAnimationFrame(updateTime);

    // 주기적 재동기화
    syncIntervalRef.current = setInterval(() => {
      void syncTime();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (activeUrlRef.current === serverUrl) {
        activeUrlRef.current = null;
      }
      inFlightRef.current?.controller.abort();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (syncIntervalRef.current !== null) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [serverUrl, syncTime, updateTime]);

  return {
    ...state,
    refresh,
  };
}
