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
  captureSentryException,
  flushSentry,
  initSentry,
} from "@/monitoring/sentry";

initSentry("background");
debugLog("[Background] Service worker initialized");

function reportBackgroundException(error: unknown, feature: string): void {
  captureSentryException(error, { feature });
  void flushSentry();
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
    // Type guard: ensure message has a type property
    if (!message || typeof message !== "object" || !("type" in message)) {
      sendResponse({
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
          sendResponse(response);
        })
        .catch((error: unknown) => {
          reportBackgroundException(error, "oauth");
          warnLog(
            "[Background] OAuth handler error",
            getErrorLogDetails(error),
          );
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "알 수 없는 오류가 발생했습니다.",
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
          sendResponse(reauthResponse);
        })
        .catch((error: unknown) => {
          reportBackgroundException(error, "silent_reauth");
          warnLog(
            "[Background] Silent reauth error",
            getErrorLogDetails(error),
          );
          sendResponse({
            success: false,
            error:
              error instanceof Error ? error.message : "재인증에 실패했습니다.",
          } as SilentReauthResponse);
        });

      return true;
    }

    if (isTimetableImportMessage(typedMessage)) {
      handleTimetableImport(typedMessage.data?.mode)
        .then((response: TimetableImportResponse) => {
          sendResponse(response);
        })
        .catch((error: unknown) => {
          reportBackgroundException(error, "timetable_import");
          warnLog(
            "[Background] Timetable import handler error",
            getErrorLogDetails(error),
          );
          sendResponse({
            success: false,
            code: "UNKNOWN",
            error:
              error instanceof Error
                ? error.message
                : "시간표를 가져오지 못했습니다.",
          } satisfies TimetableImportResponse);
        });

      return true;
    }

    // Unknown message type
    const unknownType = (message as { type: string }).type;
    warnLog("[Background] Unknown message type", { type: unknownType });
    sendResponse({
      success: false,
      error: `Unknown message type: ${unknownType}`,
    });

    return false;
  },
);

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  debugLog("[Background] Extension installed/updated:", details.reason);

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
  void restrictLocalStorageAccess();
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
  const badgeText = formatTodoBadgeCount(count);

  if (badgeText) {
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({
      color: TODO_BADGE_BACKGROUND_COLOR,
    });
    chrome.action.setBadgeTextColor({ color: TODO_BADGE_TEXT_COLOR });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Initialize badge on service worker start
chrome.storage.local.get("todoCount", (data) => {
  const count = typeof data.todoCount === "number" ? data.todoCount : 0;
  updateBadge(count);
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
  BackgroundMessage,
  GoogleLoginResponse,
  SilentReauthResponse,
  TimetableImportResponse,
};
export { BackgroundMessageType };
