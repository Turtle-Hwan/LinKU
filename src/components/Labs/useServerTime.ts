import { useState, useEffect, useCallback, useRef } from "react";

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

const SYNC_INTERVAL = 1000; // 1초마다 재동기화

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
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 서버 시간 동기화
  const syncTime = useCallback(async () => {
    try {
      const t0 = Date.now();

      const response = await fetch(serverUrl, {
        method: "HEAD",
        cache: "no-store",
      });

      const t3 = Date.now();
      const dateHeader = response.headers.get("Date");

      if (!dateHeader) {
        throw new Error("서버에서 Date 헤더를 받을 수 없습니다");
      }

      const serverDate = new Date(dateHeader);
      const serverTime = serverDate.getTime();

      // RTT (왕복 지연 시간)
      const rtt = t3 - t0;

      // offset 계산: 서버 시간 - (요청 시작 + RTT/2)
      // 이렇게 하면 네트워크 지연의 중간점에서의 시간 차이를 계산
      const midpoint = t0 + rtt / 2;
      const offset = serverTime - midpoint;

      offsetRef.current = offset;

      setState((prev) => ({
        ...prev,
        offset,
        rtt,
        lastSync: new Date(),
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      console.error("[ServerClock] Sync error:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "동기화 실패",
      }));
    }
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
    // 상태 초기화
    setState({
      serverTime: null,
      offset: 0,
      rtt: 0,
      lastSync: null,
      isLoading: true,
      error: null,
    });
    offsetRef.current = 0;

    // 초기 동기화
    syncTime();

    // 실시간 시간 업데이트 시작
    animationFrameRef.current = requestAnimationFrame(updateTime);

    // 주기적 재동기화
    syncIntervalRef.current = setInterval(syncTime, SYNC_INTERVAL);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [serverUrl, syncTime, updateTime]);

  return {
    ...state,
    refresh,
  };
}
