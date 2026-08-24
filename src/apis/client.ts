/**
 * HTTP Client for LinKU API
 * Consolidated client with type-safe HTTP methods and auth interceptors
 */

import type { ApiResponse, RequestConfig } from "../types/api";
import { BackgroundMessageType } from "../background/types";
import type { SilentReauthResponse } from "../background/types";
import { getChromeApi, getStorage, removeStorage } from "../utils/chrome";
import {
  debugLog,
  getErrorLogDetails,
  warnLog,
} from "@/utils/logger";
import {
  createErrorReporter,
  recordBreadcrumb,
  reportMessage,
} from "@/monitoring";
import {
  classifyNetworkFailure,
  isExpectedNetworkFailure,
} from "@/utils/networkFailure";

/**
 * Token expired error code from backend
 */
const TOKEN_EXPIRED_CODE = 5004;

function getSafeEndpoint(url: string): string {
  try {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "chrome-extension://linku.invalid";
    return new URL(url, baseUrl).pathname;
  } catch {
    return url.split("?")[0] || "[unknown]";
  }
}

const captureApiException = createErrorReporter({
  category: "api.error",
  mechanism: "fetch",
});

function reportApiException(
  error: unknown,
  feature: string,
  extras?: Record<string, unknown>,
): void {
  captureApiException(error, {
    feature,
    breadcrumbMessage: `${feature} captured`,
    extras,
  });
}

function getApiErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("code" in data)) {
    return undefined;
  }

  const code = (data as Record<string, unknown>).code;
  return typeof code === "string" || typeof code === "number"
    ? String(code).slice(0, 64)
    : undefined;
}

function getResponseShape(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    return { response_type: "array", response_length: data.length };
  }

  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    return {
      response_type: "object",
      response_key_count: keys.length,
      response_keys: keys.slice(0, 20),
    };
  }

  return { response_type: typeof data };
}

function recordApiHttpFailure(
  method: string,
  endpoint: string,
  response: Response,
  data: unknown,
): void {
  const status = response.status;
  const level = status >= 500 ? "error" : "warning";
  const extras = {
    endpoint,
    method: method.toUpperCase(),
    status,
    status_text: response.statusText,
    error_code: getApiErrorCode(data),
    ...getResponseShape(data),
  };

  recordBreadcrumb(
    "api.response",
    "non-success HTTP response",
    extras,
    level,
  );

  // 4xx responses and backend user-facing codes are request outcomes, not
  // product defects. Only an unexpected server-side terminal response owns a
  // Sentry issue here.
  if (status < 500) {
    return;
  }

  reportMessage(`LinKU API HTTP ${status}`, {
    feature: "api_http_error",
    category: "api.response",
    breadcrumbMessage: "server-side HTTP failure",
    level,
    mechanism: "fetch.response",
    tags: {
      http_status: String(status),
      http_method: method.toUpperCase(),
    },
    extras,
  });
}

async function readHttpFailureBody(
  response: Response,
  endpoint: string,
): Promise<unknown> {
  const contentType = response.headers.get("content-type");

  try {
    const bodyText = await response.text();
    if (!contentType?.includes("application/json") || !bodyText.trim()) {
      return bodyText;
    }

    try {
      return JSON.parse(bodyText) as unknown;
    } catch (error) {
      // The HTTP status is the failure owner. A proxy-generated HTML error
      // page that incorrectly advertises JSON must not create a parse issue in
      // addition to the HTTP outcome.
      recordBreadcrumb(
        "api.response",
        "non-success response body was not valid JSON",
        {
          endpoint,
          status: response.status,
          content_type: contentType,
        },
        "warning",
      );
      warnLog(
        "[API Client] Ignoring malformed non-success response body",
        getErrorLogDetails(error),
      );
      return bodyText;
    }
  } catch (error) {
    recordBreadcrumb(
      "api.response",
      "non-success response body was unavailable",
      {
        endpoint,
        status: response.status,
        content_type: contentType,
      },
      "warning",
    );
    warnLog(
      "[API Client] Failed to read non-success response body",
      getErrorLogDetails(error),
    );
    return undefined;
  }
}

function isTokenExpiredResponse(data: unknown): boolean {
  if (!data || typeof data !== "object" || !("code" in data)) {
    return false;
  }

  const code = (data as Record<string, unknown>).code;
  return code === TOKEN_EXPIRED_CODE || code === String(TOKEN_EXPIRED_CODE);
}

/**
 * Reauth state to prevent multiple simultaneous OAuth popups
 */
let isReauthenticating = false;
let reauthPromise: Promise<boolean> | null = null;

/**
 * API Base URL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * API Endpoints
 */
export const ENDPOINTS = {
  // Auth
  AUTH: {
    GOOGLE_OAUTH: "/oauth2/authorization/google",
    SEND_CODE: "/auth/send-code",
    VERIFY_CODE: "/auth/verify-code",
  },

  // Alerts
  ALERTS: {
    MY: "/alerts/my",
    SUBSCRIPTION: "/alerts/subscription",
    MY_SUBSCRIPTION: "/alerts/subscription/my",
    SUBSCRIBE: (departmentId: number) => `/alerts/subscription/${departmentId}`,
    UNSUBSCRIBE: (departmentId: number) =>
      `/alerts/subscription/${departmentId}`,
  },
} as const;

/**
 * Token Management
 * Using chrome.storage.local for persistent token storage
 */
async function getAccessToken(): Promise<string | null> {
  const token = await getStorage<unknown>("accessToken");
  return typeof token === "string" ? token : null;
}

async function clearAccessToken(): Promise<void> {
  await removeStorage([
    "accessToken",
    "refreshToken",
    "guestToken",
  ]);
}

/**
 * Handle token expiration by triggering silent re-authentication
 * Sends SILENT_REAUTH message to background script to re-trigger Google OAuth
 * Uses flags to prevent multiple simultaneous OAuth popups
 * @returns Promise<boolean> - true if reauth succeeded, false otherwise
 */
async function handleTokenExpired(): Promise<boolean> {
  // If already reauthenticating, wait for the existing promise
  if (isReauthenticating && reauthPromise) {
    debugLog("[API Client] Reauth already in progress, waiting...");
    return reauthPromise;
  }

  debugLog("[API Client] Token expired (5004), attempting silent reauth...");

  const chromeApi = getChromeApi();
  if (!chromeApi?.runtime?.sendMessage) {
    return false;
  }

  isReauthenticating = true;
  reauthPromise = (async () => {
    try {
      const response = await chromeApi.runtime.sendMessage<
        { type: BackgroundMessageType.SILENT_REAUTH },
        SilentReauthResponse
      >({
        type: BackgroundMessageType.SILENT_REAUTH,
      });

      if (response?.success) {
        debugLog("[API Client] Silent reauth succeeded");
        return true;
      } else {
        recordBreadcrumb("api.auth", "silent reauth was not completed", {
          error: response?.error,
        });
        warnLog("[API Client] Silent reauth failed", {
          error: response?.error,
        });
        return false;
      }
    } catch (error) {
      reportApiException(error, "silent_reauth_request");
      warnLog("[API Client] Silent reauth error", getErrorLogDetails(error));
      return false;
    } finally {
      isReauthenticating = false;
      reauthPromise = null;
    }
  })();

  return reauthPromise;
}

/**
 * Request Interceptors
 */
async function applyRequestInterceptors(
  options: RequestInit,
): Promise<RequestInit> {
  const headers = new Headers(options.headers);
  const token = await getAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return {
    ...options,
    headers,
  };
}

/**
 * Response Interceptors
 */
function applyResponseInterceptors<T>(
  response: ApiResponse<T>,
): ApiResponse<T> {
  if (response.status === 401) {
    void clearAccessToken().catch((error: unknown) => {
      reportApiException(error, "clear_expired_access_token");
    });
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
  return response;
}

/**
 * Build URL with query parameters
 */
function buildUrl(url: string, params?: unknown): string {
  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const separator = url.includes("?") ? "&" : "?";
  const queryString = searchParams.toString();
  return queryString ? `${url}${separator}${queryString}` : url;
}

/**
 * Core request function
 * @param isRetry - Internal flag to prevent infinite retry loops on 5004 error
 */
async function request<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
  config?: RequestConfig,
  isRetry: boolean = false,
): Promise<ApiResponse<T>> {
  let safeEndpoint = getSafeEndpoint(url);

  try {
    const { headers = {}, params, ...restConfig } = config || {};

    // Build full URL
    const urlWithParams = buildUrl(url, params);
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? urlWithParams
        : `${API_BASE_URL}${urlWithParams}`;
    safeEndpoint = getSafeEndpoint(fullUrl);

    // Build request options
    let requestOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      credentials: "include",
      ...restConfig,
    };

    // Add body
    if (body !== undefined) {
      if (body instanceof FormData) {
        delete (requestOptions.headers as Record<string, string>)[
          "Content-Type"
        ];
        requestOptions.body = body;
      } else if (
        headers["Content-Type"] === "application/x-www-form-urlencoded"
      ) {
        requestOptions.body = body as string;
      } else {
        requestOptions.body = JSON.stringify(body);
      }
    }

    // Apply interceptors
    requestOptions = await applyRequestInterceptors(requestOptions);

    recordBreadcrumb("api.request", "request started", {
      endpoint: safeEndpoint,
      method: method.toUpperCase(),
      retry: isRetry,
      has_body: body !== undefined,
    });

    // Fetch
    const response = await fetch(fullUrl, requestOptions);
    recordBreadcrumb(
      "api.response",
      "response received",
      {
        endpoint: safeEndpoint,
        method: method.toUpperCase(),
        status: response.status,
        ok: response.ok,
      },
      response.ok
        ? "info"
        : response.status >= 500
          ? "error"
          : "warning",
    );

    // Route non-success responses before parsing success payloads. Error pages
    // from proxies and upstream servers frequently contain HTML even when the
    // content-type claims JSON; the HTTP status remains the failure owner.
    const contentType = response.headers.get("content-type");
    let data: T;

    if (!response.ok) {
      data = (await readHttpFailureBody(response, safeEndpoint)) as T;
    } else {
      try {
        if (contentType?.includes("application/json")) {
          data = await response.json();
        } else {
          data = (await response.text()) as T;
        }
      } catch (parseError) {
        reportApiException(parseError, "api_response_parse", {
          endpoint: safeEndpoint,
          status: response.status,
          content_type: contentType,
        });
        warnLog("[API Client] Response parsing error", {
          ...getErrorLogDetails(parseError),
          status: response.status,
          endpoint: safeEndpoint,
        });
        return {
          success: false,
          error: {
            code: "PARSE_ERROR",
            message: "서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해주세요.",
          },
          status: response.status,
        };
      }
    }

    // Check for token expired error (5004) and attempt silent reauth
    if (isTokenExpiredResponse(data)) {
      const authExtras = {
        endpoint: safeEndpoint,
        method: method.toUpperCase(),
        status: response.status,
        error_code: String(TOKEN_EXPIRED_CODE),
        retry: isRetry,
      };
      recordBreadcrumb(
        "api.auth",
        "expired token response handled",
        authExtras,
        "warning",
      );
      debugLog(
        "[API Client] Detected 5004 token expired error, attempting reauth...",
      );

      const reauthSuccess = !isRetry && (await handleTokenExpired());

      if (reauthSuccess) {
        // Retry the original request with new token
        debugLog("[API Client] Retrying request after successful reauth");
        return request<T>(url, method, body, config, true);
      } else {
        // Reauth failed, clear tokens and notify
        warnLog("[API Client] Reauth failed, clearing tokens");
        await clearAccessToken();
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));

        return {
          success: false,
          error: {
            code: String(TOKEN_EXPIRED_CODE),
            message: "세션이 만료되었습니다. 다시 로그인해주세요.",
          },
          status: 401,
        };
      }
    }

    // Handle error responses FIRST (preserve original error data before result extraction)
    if (!response.ok) {
      const errorData =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : undefined;
      recordApiHttpFailure(method, safeEndpoint, response, data);
      return applyResponseInterceptors({
        success: false,
        error: {
          code: String(errorData?.code || response.status),
          message:
            (errorData?.message as string) ||
            `HTTP Error: ${response.status} ${response.statusText}`,
        },
        status: response.status,
        data,
      });
    }

    // For SUCCESS responses only: extract 'result' field if present
    if (data && typeof data === "object" && "result" in data) {
      const backendResponse = data as Record<string, unknown>;
      if (
        backendResponse.result !== undefined &&
        backendResponse.result !== null
      ) {
        data = backendResponse.result as T;
      }
    }

    return applyResponseInterceptors({
      success: true,
      data,
      status: response.status,
    });
  } catch (error) {
    const networkFailureKind = classifyNetworkFailure(error);
    const failureContext = {
      endpoint: safeEndpoint,
      method,
      network_failure_kind: networkFailureKind,
    };
    recordBreadcrumb(
      "api.network",
      "request transport failed",
      failureContext,
      "warning",
    );
    if (!isExpectedNetworkFailure(error)) {
      reportApiException(error, "api_network_error", failureContext);
    }
    warnLog("[API Client] Request error", getErrorLogDetails(error));
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
      },
    };
  }
}

/**
 * HTTP Methods
 */
export async function get<T = unknown>(
  url: string,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return request<T>(url, "GET", undefined, config);
}

export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return request<T>(url, "POST", data, config);
}

export async function del<T = unknown>(
  url: string,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  return request<T>(url, "DELETE", undefined, config);
}
