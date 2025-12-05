/**
 * HTTP Client for LinKU API
 * Consolidated client with type-safe HTTP methods and auth interceptors
 */

import type { ApiResponse, RequestConfig } from "../types/api";
import { BackgroundMessageType } from "../background/types";
import type { SilentReauthResponse } from "../background/types";

/**
 * Token expired error code from backend
 */
const TOKEN_EXPIRED_CODE = 5004;

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

  // Templates
  TEMPLATES: {
    BASE: "/templates",
    DETAIL: (id: number) => `/templates/${id}`,
    OWNED: "/templates/owned",
    CLONED: "/templates/cloned",
    POST: (id: number) => `/templates/${id}/post`,
  },

  // Posted Templates
  POSTED_TEMPLATES: {
    PUBLIC: "/posted-templates/public",
    MY: "/posted-templates/my",
    DETAIL: (id: number) => `/posted-templates/${id}`,
    CLONE: (id: number) => `/posted-templates/${id}/clone`,
    LIKE: (id: number) => `/posted-templates/${id}/like`,
    DELETE: (id: number) => `/posted-templates/${id}`,
  },

  // Icons
  ICONS: {
    BASE: "/icons",
    DEFAULT: "/icons/default",
    MY: "/icons/my",
    RENAME: (id: number) => `/icons/${id}/rename`,
    DELETE: (id: number) => `/icons/${id}`,
  },

  // Alerts
  ALERTS: {
    MY: "/alerts/my",
    SUBSCRIPTION: "/alerts/subscription",
    MY_SUBSCRIPTION: "/alerts/subscription/my",
    SUBSCRIBE: (departmentId: number) => `/alerts/subscription/${departmentId}`,
    UNSUBSCRIBE: (departmentId: number) => `/alerts/subscription/${departmentId}`,
  },
} as const;

/**
 * Token Management
 * Using chrome.storage.local for persistent token storage
 */
async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(["accessToken"]);
  return result.accessToken || null;
}

async function clearAccessToken(): Promise<void> {
  await chrome.storage.local.remove(["accessToken", "refreshToken", "guestToken"]);
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
    console.log('[API Client] Reauth already in progress, waiting...');
    return reauthPromise;
  }

  console.log('[API Client] Token expired (5004), attempting silent reauth...');

  isReauthenticating = true;
  reauthPromise = (async () => {
    try {
      const response = await chrome.runtime.sendMessage<
        { type: BackgroundMessageType.SILENT_REAUTH },
        SilentReauthResponse
      >({
        type: BackgroundMessageType.SILENT_REAUTH,
      });

      if (response?.success) {
        console.log('[API Client] Silent reauth succeeded');
        return true;
      } else {
        console.warn('[API Client] Silent reauth failed:', response?.error);
        return false;
      }
    } catch (error) {
      console.warn('[API Client] Silent reauth error:', error);
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
async function applyRequestInterceptors(options: RequestInit): Promise<RequestInit> {
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
  response: ApiResponse<T>
): ApiResponse<T> {
  if (response.status === 401) {
    clearAccessToken();
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
  isRetry: boolean = false
): Promise<ApiResponse<T>> {
  try {
    const { headers = {}, params, ...restConfig } = config || {};

    // Build full URL
    const urlWithParams = buildUrl(url, params);
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? urlWithParams
        : `${API_BASE_URL}${urlWithParams}`;

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

    // Fetch
    const response = await fetch(fullUrl, requestOptions);

    // Parse response
    const contentType = response.headers.get("content-type");
    let data: T;

    try {
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = (await response.text()) as T;
      }
    } catch (parseError) {
      console.error("Response parsing error:", parseError);
      // If parsing fails, return error response
      return {
        success: false,
        error: {
          code: "PARSE_ERROR",
          message: `응답 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        },
        status: response.status,
      };
    }

    // Check for token expired error (5004) and attempt silent reauth
    if (
      !isRetry &&
      data &&
      typeof data === 'object' &&
      'code' in data &&
      (data as Record<string, unknown>).code === TOKEN_EXPIRED_CODE
    ) {
      console.log('[API Client] Detected 5004 token expired error, attempting reauth...');

      const reauthSuccess = await handleTokenExpired();

      if (reauthSuccess) {
        // Retry the original request with new token
        console.log('[API Client] Retrying request after successful reauth');
        return request<T>(url, method, body, config, true);
      } else {
        // Reauth failed, clear tokens and notify
        console.warn('[API Client] Reauth failed, clearing tokens');
        await clearAccessToken();
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));

        return {
          success: false,
          error: {
            code: String(TOKEN_EXPIRED_CODE),
            message: '세션이 만료되었습니다. 다시 로그인해주세요.',
          },
          status: 401,
        };
      }
    }

    // Handle error responses FIRST (preserve original error data before result extraction)
    if (!response.ok) {
      const errorData = data as Record<string, unknown>;
      return applyResponseInterceptors({
        success: false,
        error: {
          code: String(errorData?.code || response.status),
          message: (errorData?.message as string) || `HTTP Error: ${response.status} ${response.statusText}`,
        },
        status: response.status,
        data,
      });
    }

    // For SUCCESS responses only: extract 'result' field if present
    if (data && typeof data === 'object' && 'result' in data) {
      const backendResponse = data as Record<string, unknown>;
      if (backendResponse.result !== undefined && backendResponse.result !== null) {
        data = backendResponse.result as T;
      }
    }

    return applyResponseInterceptors({
      success: true,
      data,
      status: response.status,
    });
  } catch (error) {
    console.warn("API Request Error:", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * HTTP Methods
 */
export async function get<T = unknown>(
  url: string,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>(url, "GET", undefined, config);
}

export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>(url, "POST", data, config);
}

export async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>(url, "PUT", data, config);
}

export async function del<T = unknown>(
  url: string,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>(url, "DELETE", undefined, config);
}

export async function patch<T = unknown>(
  url: string,
  data?: unknown,
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  return request<T>(url, "PATCH", data, config);
}
