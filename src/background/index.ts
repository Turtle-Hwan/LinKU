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
} from "./types";
import { debugLog, getErrorLogDetails, warnLog } from "@/utils/logger";
import type {
  BackgroundMessage,
  GoogleLoginResponse,
  SilentReauthResponse,
} from "./types";
import { handleGoogleLogin } from "./handlers/oauth";

debugLog("[Background] Service worker initialized");

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
});

/**
 * Badge update for todo count
 */
function updateBadge(count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count) });
    chrome.action.setBadgeBackgroundColor({ color: "#00913A" });
    chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
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
export type { BackgroundMessage, GoogleLoginResponse, SilentReauthResponse };
export { BackgroundMessageType };
