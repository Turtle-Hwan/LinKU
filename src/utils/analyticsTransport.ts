import {
  classifyNetworkFailure,
  type NetworkFailureKind,
} from "./networkFailure.ts";

export type GAEventParam = string | number | boolean;

export interface GAEvent {
  name: string;
  params: Record<string, GAEventParam>;
}

export interface AnalyticsPayload {
  client_id: string;
  events: GAEvent[];
}

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
const MAX_EVENTS_PER_REQUEST = 25;
const MAX_EVENT_PARAMS = 25;
const MAX_CLIENT_ID_LENGTH = 128;
const MAX_PARAM_VALUE_LENGTH = 4096;
const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/u;
const PARAM_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/u;
const DEFAULT_TIMEOUT_MS = 10_000;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isGAEventParam(value: unknown): value is GAEventParam {
  if (typeof value === "string") {
    return value.length <= MAX_PARAM_VALUE_LENGTH;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "boolean";
}

function isGAEvent(value: unknown): value is GAEvent {
  if (!isPlainRecord(value)) return false;
  if (typeof value.name !== "string" || !EVENT_NAME_PATTERN.test(value.name)) {
    return false;
  }
  if (!isPlainRecord(value.params)) return false;

  const params = Object.entries(value.params);
  return (
    params.length <= MAX_EVENT_PARAMS &&
    params.every(
      ([name, param]) =>
        PARAM_NAME_PATTERN.test(name) && isGAEventParam(param),
    )
  );
}

export function isAnalyticsPayload(value: unknown): value is AnalyticsPayload {
  if (!isPlainRecord(value)) return false;
  if (
    typeof value.client_id !== "string" ||
    value.client_id.length === 0 ||
    value.client_id.length > MAX_CLIENT_ID_LENGTH
  ) {
    return false;
  }
  if (!Array.isArray(value.events)) return false;

  return (
    value.events.length > 0 &&
    value.events.length <= MAX_EVENTS_PER_REQUEST &&
    value.events.every(isGAEvent)
  );
}

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
