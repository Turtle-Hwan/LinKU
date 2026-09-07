/**
 * Background Service Worker for LinKU Chrome Extension
 *
 * This service worker handles:
 * - Google OAuth authentication (chrome.identity API)
 * - Message passing between popup and background
 *
 * Note: chrome.identity API is ONLY available in background/service worker context
 */

import {
  BackgroundMessageType,
  isAnalyticsBatchMessage,
  isGoogleLoginMessage,
  isTimetableImportMessage,
} from "./types";
import {
  debugLog,
  getErrorLogDetails,
  captureWarnLog,
  warnLog,
} from "@/utils/logger";
import type {
  BackgroundMessage,
  AnalyticsTransportResponse,
  GoogleLoginResponse,
  TimetableImportResponse,
} from "./types";
import { handleGoogleLogin } from "./handlers/oauth";
import {
  formatTodoBadgeCount,
  TODO_BADGE_BACKGROUND_COLOR,
  TODO_BADGE_TEXT_COLOR,
} from "@/utils/todo/badge";
import {
  isTransientChromeStorageLock,
  retryChromeOperation,
} from "@/utils/chromeRetry";
import {
  handlePendingImportTabRemoved,
  handlePendingImportTabUpdated,
  handleTimetableImport,
} from "./handlers/timetable";
import { registerBannerCache } from "./handlers/bannerCache";
import {
  createErrorReporter,
  createRuntimeMessageResponder,
  flushMonitoring,
  getRuntimeMessageType,
  initMonitoring,
  recordBreadcrumb,
} from "@/monitoring";
import {
  getUserFacingErrorMessage,
} from "@/errors/userFacingError";
import { deliverAnalyticsPayload } from "@/utils/analyticsTransport";

initMonitoring("background");
debugLog("[Background] Service worker initialized");
recordBreadcrumb("background.lifecycle", "service worker initialized");

registerBannerCache((error) => {
  captureWarnLog("[Background] Banner cache refresh failed", error);
});

const captureBackgroundException = createErrorReporter({
  category: "background.error",
  mechanism: "background.handler",
});

const ANALYTICS_MEASUREMENT_ID = "G-ECMY8N9FX4";
const analyticsTransportConfig = {
  measurementId: ANALYTICS_MEASUREMENT_ID,
  apiSecret: import.meta.env.VITE_GA_API_SECRET,
};
const recordedAnalyticsFailures = new Set<string>();

function recordAnalyticsTransportFailure(
  response: Extract<AnalyticsTransportResponse, { success: false }>,
  eventCount: number,
): void {
  if (
    response.failureKind === "offline" ||
    response.failureKind === "aborted" ||
    response.failureKind === "blocked_or_unreachable"
  ) {
    return;
  }

  const failureKey = [
    response.failureKind,
    response.status ?? "none",
  ].join(":");

  if (recordedAnalyticsFailures.has(failureKey)) return;
  recordedAnalyticsFailures.add(failureKey);

  recordBreadcrumb(
    "analytics.transport",
    "GA batch delivery skipped",
    {
      event_count: eventCount,
      failure_kind: response.failureKind,
      ...(response.status !== undefined && { status: response.status }),
    },
    "warning",
  );
  warnLog("[GA] Batch delivery skipped", {
    eventCount,
    failureKind: response.failureKind,
    status: response.status,
  });
}

function reportBackgroundException(
  error: unknown,
  feature: string,
  extras: Record<string, unknown> = {},
): void {
  captureBackgroundException(error, {
    feature,
    breadcrumbMessage: `${feature} captured`,
    extras,
  });
}

interface AsyncMessageHandlerOptions<Response> {
  feature: string;
  messageType: string;
  failureLog: string;
  handle: () => Promise<Response>;
  respond: (response: Response) => void;
  fallback: (error: unknown) => Response;
  extras?: Record<string, unknown>;
}

function runAsyncMessageHandler<Response>({
  feature,
  messageType,
  failureLog,
  handle,
  respond,
  fallback,
  extras,
}: AsyncMessageHandlerOptions<Response>): true {
  void Promise.resolve()
    .then(handle)
    .then(respond)
    .catch((error: unknown) => {
      reportBackgroundException(error, feature, {
        message_type: messageType,
        ...extras,
      });
      warnLog(failureLog, error);
      respond(fallback(error));
    });

  return true;
}

async function restrictLocalStorageAccess(): Promise<void> {
  if (typeof chrome.storage.local.setAccessLevel !== "function") {
    recordBreadcrumb(
      "background.compatibility",
      "storage access level API unavailable",
      { api: "chrome.storage.local.setAccessLevel" },
      "warning",
    );
    return;
  }

  try {
    await chrome.storage.local.setAccessLevel({
      accessLevel: "TRUSTED_CONTEXTS",
    });
  } catch (error) {
    reportBackgroundException(error, "storage_access_level");
    warnLog(
      "[Background] Failed to restrict local storage access",
      getErrorLogDetails(error),
    );
  }
}

void restrictLocalStorageAccess();

/**
 * Message handler for popup -> background communication
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    const messageType = getRuntimeMessageType(message);
    const respond = createRuntimeMessageResponder({
      runtime: "background",
      messageType,
      sendResponse,
    });

    try {
      recordBreadcrumb("background.message", "message received", {
        message_type: messageType,
      });

      // Type guard: ensure message has a type property
      if (!message || typeof message !== "object" || !("type" in message)) {
        // Every LinKU sender posts a typed message, so an untyped one means a
        // caller regressed or a third party is talking to the worker.
        recordBreadcrumb(
          "background.message",
          "rejected message without a type",
          undefined,
          "warning",
        );
        warnLog("[Background] Rejected message without a type");
        respond({
          success: false,
          error: "Invalid message format",
        });
        return false;
      }

      // At this point, message is an object with a type property
      // Cast to BackgroundMessage for type-safe handling
      const typedMessage = message as BackgroundMessage;
      debugLog("[Background] Message received:", typedMessage.type);

      // Handle Google Login
      if (isGoogleLoginMessage(typedMessage)) {
        debugLog("[Background] Handling Google login request");

        return runAsyncMessageHandler<GoogleLoginResponse>({
          feature: "oauth",
          messageType,
          failureLog: "[Background] OAuth handler error",
          handle: async () => {
            const response = await handleGoogleLogin();
            debugLog("[Background] Sending OAuth response to popup");
            return response;
          },
          respond,
          fallback: (error) => ({
            success: false,
            error: getUserFacingErrorMessage(
              error,
              "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
            ),
          }),
        });
      }

      if (isTimetableImportMessage(typedMessage)) {
        return runAsyncMessageHandler<TimetableImportResponse>({
          feature: "timetable_import",
          messageType,
          failureLog: "[Background] Timetable import handler error",
          handle: () => handleTimetableImport(typedMessage.data?.mode),
          respond,
          fallback: (error) => ({
            success: false,
            code: "UNKNOWN",
            error: getUserFacingErrorMessage(
              error,
              "시간표를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
            ),
          }),
        });
      }

      if (isAnalyticsBatchMessage(typedMessage)) {
        const eventCount = typedMessage.data.payload.events.length;

        return runAsyncMessageHandler<AnalyticsTransportResponse>({
          feature: "analytics_transport",
          messageType,
          failureLog: "[Background] Analytics transport error",
          extras: { event_count: eventCount },
          handle: async () => {
            const response = await deliverAnalyticsPayload(
              typedMessage.data.payload,
              analyticsTransportConfig,
            );
            if (response.success) {
              debugLog("[GA] Batch delivered", {
                eventCount,
                status: response.status,
              });
            } else {
              recordAnalyticsTransportFailure(response, eventCount);
            }
            return response;
          },
          respond,
          fallback: () => ({
            success: false,
            failureKind: "unknown",
          }),
        });
      }

      // Unknown message type
      recordBreadcrumb(
        "background.message",
        "rejected unknown message type",
        { message_type: messageType },
        "warning",
      );
      warnLog("[Background] Unknown message type", { type: messageType });
      respond({
        success: false,
        error: `Unknown message type: ${messageType}`,
      });

      return false;
    } catch (error) {
      reportBackgroundException(error, "message_handler", {
        message_type: messageType,
      });
      respond({
        success: false,
        error: "요청을 처리하지 못했습니다.",
      });
      return false;
    }
  },
);

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  debugLog("[Background] Extension installed/updated:", details.reason);
  recordBreadcrumb("background.lifecycle", "extension installed event", {
    reason: details.reason,
  });

  if (details.reason === "install") {
    debugLog("[Background] First install - welcome!");
  } else if (details.reason === "update") {
    debugLog("[Background] Extension updated");
  }
});

/**
 * Keep service worker alive (optional, for debugging)
 */
chrome.runtime.onStartup.addListener(() => {
  debugLog("[Background] Browser started, service worker activated");
  recordBreadcrumb("background.lifecycle", "browser startup event");
});

chrome.runtime.onSuspend.addListener(() => {
  recordBreadcrumb("background.lifecycle", "service worker suspending");
  void flushMonitoring();
});

chrome.runtime.onSuspendCanceled.addListener(() => {
  recordBreadcrumb("background.lifecycle", "service worker suspend canceled");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handlePendingImportTabUpdated(tabId, changeInfo, tab).catch(
    (error: unknown) => {
      reportBackgroundException(error, "pending_import_resume");
      warnLog(
        "[Background] Pending timetable import resume failed",
        getErrorLogDetails(error),
      );
    },
  );
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handlePendingImportTabRemoved(tabId).catch((error: unknown) => {
    reportBackgroundException(error, "pending_import_cleanup");
    warnLog(
      "[Background] Pending timetable import cleanup failed",
      getErrorLogDetails(error),
    );
  });
});

/**
 * Badge update for todo count
 */
function updateBadge(count: number) {
  try {
    const badgeText = formatTodoBadgeCount(count);
    const operations = [
      chrome.action.setBadgeText({ text: badgeText || "" }),
    ];

    if (badgeText) {
      operations.push(
        chrome.action.setBadgeBackgroundColor({
          color: TODO_BADGE_BACKGROUND_COLOR,
        }),
        chrome.action.setBadgeTextColor({ color: TODO_BADGE_TEXT_COLOR }),
      );
    }

    void Promise.all(operations).catch((error: unknown) => {
      reportBackgroundException(error, "badge_update", {
        has_badge_text: Boolean(badgeText),
      });
    });
  } catch (error) {
    reportBackgroundException(error, "badge_update", {
      count_type: typeof count,
    });
  }
}

function readStoredTodoCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get("todoCount", (data) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(typeof data.todoCount === "number" ? data.todoCount : 0);
      });
    } catch (error) {
      reject(error);
    }
  });
}

void retryChromeOperation(readStoredTodoCount, {
  maxAttempts: 3,
  delayMs: 100,
  shouldRetry: isTransientChromeStorageLock,
})
  .then(updateBadge)
  .catch((error: unknown) => {
    reportBackgroundException(error, "badge_storage_get");
  });

// Listen for todoCount changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.todoCount) {
    const count =
      typeof changes.todoCount.newValue === "number"
        ? changes.todoCount.newValue
        : 0;
    updateBadge(count);
  }
});

// Export for type checking (not used at runtime)
export type {
  AnalyticsTransportResponse,
  BackgroundMessage,
  GoogleLoginResponse,
  TimetableImportResponse,
};
export { BackgroundMessageType };
