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
  isGoogleLoginMessage,
  isSilentReauthMessage,
  isTimetableImportMessage,
} from "./types";
import { debugLog, getErrorLogDetails, warnLog } from "@/utils/logger";
import type {
  BackgroundMessage,
  GoogleLoginResponse,
  SilentReauthResponse,
  TimetableImportResponse,
} from "./types";
import { handleGoogleLogin } from "./handlers/oauth";
import {
  formatTodoBadgeCount,
  TODO_BADGE_BACKGROUND_COLOR,
  TODO_BADGE_TEXT_COLOR,
} from "@/utils/todo/badge";
import {
  handlePendingImportTabRemoved,
  handlePendingImportTabUpdated,
  handleTimetableImport,
} from "./handlers/timetable";
import {
  createErrorReporter,
  createRuntimeMessageResponder,
  flushMonitoring,
  getRuntimeMessageType,
  initMonitoring,
  recordBreadcrumb,
} from "@/monitoring";
import { getUserFacingErrorMessage } from "@/errors/userFacingError";

initMonitoring("background");
debugLog("[Background] Service worker initialized");
recordBreadcrumb("background.lifecycle", "service worker initialized");

const captureBackgroundException = createErrorReporter({
  category: "background.error",
  mechanism: "background.handler",
});

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

async function restrictLocalStorageAccess(): Promise<void> {
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

        // Handle async OAuth flow
        handleGoogleLogin()
          .then((response: GoogleLoginResponse) => {
            debugLog("[Background] Sending OAuth response to popup");
            respond(response);
          })
          .catch((error: unknown) => {
            reportBackgroundException(error, "oauth", {
              message_type: messageType,
            });
            warnLog(
              "[Background] OAuth handler error",
              getErrorLogDetails(error),
            );
            respond({
              success: false,
              error: getUserFacingErrorMessage(
                error,
                "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
              ),
            });
          });

        // Return true to indicate async response
        return true;
      }

      // Handle Silent Reauth (when token expires - 5004 error)
      if (isSilentReauthMessage(typedMessage)) {
        debugLog(
          "[Background] Handling silent reauth request (token expired)",
        );

        // Reuse Google OAuth flow for silent reauth
        handleGoogleLogin()
          .then((response: GoogleLoginResponse) => {
            debugLog(
              "[Background] Silent reauth completed:",
              response.success,
            );
            const reauthResponse: SilentReauthResponse = {
              success: response.success,
              error: response.success
                ? undefined
                : (response as { error?: string }).error,
            };
            respond(reauthResponse);
          })
          .catch((error: unknown) => {
            reportBackgroundException(error, "silent_reauth", {
              message_type: messageType,
            });
            warnLog(
              "[Background] Silent reauth error",
              getErrorLogDetails(error),
            );
            respond({
              success: false,
              error: getUserFacingErrorMessage(
                error,
                "재인증에 실패했습니다. 다시 로그인해주세요.",
              ),
            } as SilentReauthResponse);
          });

        return true;
      }

      if (isTimetableImportMessage(typedMessage)) {
        handleTimetableImport(typedMessage.data?.mode)
          .then((response: TimetableImportResponse) => {
            respond(response);
          })
          .catch((error: unknown) => {
            reportBackgroundException(error, "timetable_import", {
              message_type: messageType,
            });
            warnLog(
              "[Background] Timetable import handler error",
              getErrorLogDetails(error),
            );
            respond({
              success: false,
              code: "UNKNOWN",
              error: getUserFacingErrorMessage(
                error,
                "시간표를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
              ),
            } satisfies TimetableImportResponse);
          });

        return true;
      }

      // Unknown message type
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
  void restrictLocalStorageAccess();
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

// Initialize badge on service worker start
try {
  chrome.storage.local.get("todoCount", (data) => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      reportBackgroundException(lastError, "badge_storage_get");
      return;
    }

    const count = typeof data.todoCount === "number" ? data.todoCount : 0;
    updateBadge(count);
  });
} catch (error) {
  reportBackgroundException(error, "badge_storage_get");
}

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
  BackgroundMessage,
  GoogleLoginResponse,
  SilentReauthResponse,
  TimetableImportResponse,
};
export { BackgroundMessageType };
