import {
  classifyNetworkFailure,
  type NetworkFailureKind,
} from "./networkFailure.ts";
import type { AnalyticsPayload } from "./analyticsContract.ts";

export interface AnalyticsTransportConfig {
  measurementId: string;
  apiSecret?: string;
  timeoutMs?: number;
}

export type AnalyticsTransportFailureKind =
  | NetworkFailureKind
  | "http_error"
  | "unconfigured";

export type AnalyticsTransportResponse =
  | { success: true; status: number }
  | {
      success: false;
      failureKind: AnalyticsTransportFailureKind;
      status?: number;
    };

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

export function resolveAnalyticsUrl(
  config: AnalyticsTransportConfig,
): string | AnalyticsTransportResponse {
  const measurementId = config.measurementId.trim();
  const apiSecret = config.apiSecret?.trim();
  if (!measurementId || !apiSecret) {
    return { success: false, failureKind: "unconfigured" };
  }

  const url = new URL(GA_ENDPOINT);
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);
  return url.toString();
}

export async function deliverAnalyticsPayload(
  payload: AnalyticsPayload,
  config: AnalyticsTransportConfig,
  fetchImpl: AnalyticsFetch = fetch,
  online: boolean | undefined = globalThis.navigator?.onLine,
): Promise<AnalyticsTransportResponse> {
  const url = resolveAnalyticsUrl(config);
  if (typeof url !== "string") {
    return url;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(url, {
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
        status: response.status,
      };
    }

    return {
      success: true,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      failureKind: classifyNetworkFailure(error, online),
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
