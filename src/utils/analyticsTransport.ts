import {
  classifyNetworkFailure,
  type NetworkFailureKind,
} from "./networkFailure.ts";
import type { AnalyticsPayload } from "./analyticsContract.ts";

export interface AnalyticsTransportConfig {
  proxyUrl?: string;
  measurementId: string;
  apiSecret?: string;
  timeoutMs?: number;
}

export type AnalyticsTransportMode = "proxy" | "direct";
export type AnalyticsTransportFailureKind =
  | NetworkFailureKind
  | "http_error"
  | "unconfigured"
  | "invalid_proxy";

export type AnalyticsTransportResponse =
  | { success: true; mode: AnalyticsTransportMode; status: number }
  | {
      success: false;
      failureKind: AnalyticsTransportFailureKind;
      mode?: AnalyticsTransportMode;
      status?: number;
    };

interface AnalyticsDestination {
  mode: AnalyticsTransportMode;
  url: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
}

export type AnalyticsFetch = (
  input: string,
  init: RequestInit,
) => Promise<FetchResponse>;

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const DEFAULT_TIMEOUT_MS = 10_000;

function isSafeProxyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLocalDevelopment =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    return (
      (url.protocol === "https:" || isLocalDevelopment) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function resolveAnalyticsDestination(
  config: AnalyticsTransportConfig,
): AnalyticsDestination | AnalyticsTransportResponse {
  const proxyUrl = config.proxyUrl?.trim();
  if (proxyUrl) {
    if (!isSafeProxyUrl(proxyUrl)) {
      return { success: false, failureKind: "invalid_proxy" };
    }

    return { mode: "proxy", url: proxyUrl };
  }

  const measurementId = config.measurementId.trim();
  const apiSecret = config.apiSecret?.trim();
  if (!measurementId || !apiSecret) {
    return { success: false, failureKind: "unconfigured" };
  }

  const url = new URL(GA_ENDPOINT);
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);
  return { mode: "direct", url: url.toString() };
}

export async function deliverAnalyticsPayload(
  payload: AnalyticsPayload,
  config: AnalyticsTransportConfig,
  fetchImpl: AnalyticsFetch = fetch,
  online: boolean | undefined = globalThis.navigator?.onLine,
): Promise<AnalyticsTransportResponse> {
  const destination = resolveAnalyticsDestination(config);
  if ("success" in destination) {
    return destination;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(destination.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        failureKind: "http_error",
        mode: destination.mode,
        status: response.status,
      };
    }

    return {
      success: true,
      mode: destination.mode,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      failureKind: classifyNetworkFailure(error, online),
      mode: destination.mode,
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
