"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Input } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";

interface ServerTimePayload {
  sourceUrl: string;
  serverTime: string;
  roundTripMs: number;
  receivedAt: string;
}

const DEFAULT_SERVER_URL = "https://sugang.konkuk.ac.kr";

export function LabsServerClock({ locale }: { locale: AppLocale }) {
  const copy = getLabsCopy(locale);
  const [inputUrl, setInputUrl] = useState(DEFAULT_SERVER_URL);
  const [activeUrl, setActiveUrl] = useState(DEFAULT_SERVER_URL);
  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [roundTripMs, setRoundTripMs] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(0);

  const syncTime = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/labs/server-time?url=${encodeURIComponent(activeUrl)}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response.json()) as
        | ServerTimePayload
        | {
            message?: string;
          };

      if (!response.ok || !("serverTime" in data)) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Failed to sync server time.",
        );
      }

      const receivedAtMs = new Date(data.receivedAt).getTime();
      const targetServerMs = new Date(data.serverTime).getTime();
      offsetRef.current = targetServerMs - receivedAtMs;
      setServerTime(new Date(targetServerMs));
      setRoundTripMs(data.roundTripMs);
      setLastSync(new Date(data.receivedAt));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to sync server time.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeUrl]);

  useEffect(() => {
    void syncTime();
  }, [syncTime]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!serverTime) {
        return;
      }

      setServerTime(new Date(Date.now() + offsetRef.current));
    }, 100);

    return () => window.clearInterval(interval);
  }, [serverTime]);

  const formattedTime = useMemo(() => {
    if (!serverTime) {
      return "--:--:--.---";
    }

    const hours = String(serverTime.getHours()).padStart(2, "0");
    const minutes = String(serverTime.getMinutes()).padStart(2, "0");
    const seconds = String(serverTime.getSeconds()).padStart(2, "0");
    const milliseconds = String(serverTime.getMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }, [serverTime]);

  const formattedDate = useMemo(() => {
    if (!serverTime) {
      return "";
    }

    return serverTime.toLocaleString(locale === "ko" ? "ko-KR" : "en-US", {
      dateStyle: "full",
    });
  }, [locale, serverTime]);

  const formattedLastSync = useMemo(() => {
    if (!lastSync) {
      return "--:--:--";
    }

    return lastSync.toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US");
  }, [lastSync, locale]);

  return (
    <section className="rounded-[1.6rem] border border-black/8 bg-white p-6">
      <div className="space-y-2">
        <h2 className="text-2xl tracking-[-0.04em]">{copy.clock.title}</h2>
        <p className="text-sm leading-7 text-[var(--muted)]">
          {copy.clock.description}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <Input
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          aria-label={copy.clock.inputLabel}
          className="rounded-full bg-[#f6f0e1]"
        />
        <Button
          type="button"
          variant="secondary"
          className="rounded-full"
          onClick={() => setActiveUrl(inputUrl.trim() || DEFAULT_SERVER_URL)}
        >
          {copy.clock.apply}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => void syncTime()}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {copy.clock.refresh}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-[1rem] border border-[#d18d7b] bg-[#fff3ef] p-4 text-sm text-[#8a3d2c]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 rounded-[1.4rem] border border-black/8 bg-[#132a22] px-5 py-6 text-white">
        <p className="text-xs uppercase tracking-[0.24em] text-white/60">
          {copy.clock.currentTime}
        </p>
        <p className="mt-3 font-mono text-4xl tracking-[-0.04em]">{formattedTime}</p>
        {formattedDate ? (
          <p className="mt-2 text-sm text-white/75">{formattedDate}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
        <span>
          {copy.clock.lastSync}: {formattedLastSync}
        </span>
        <span>
          {copy.clock.roundTrip}: {roundTripMs}ms
        </span>
      </div>
    </section>
  );
}
