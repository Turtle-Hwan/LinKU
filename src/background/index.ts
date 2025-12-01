/**
 * Background Service Worker for LinKU Chrome Extension
 *
 * This service worker handles:
 * - Google OAuth authentication (chrome.identity API)
 * - Message passing between popup and background
 *
 * Note: chrome.identity API is ONLY available in background/service worker context
 */

import { BackgroundMessageType, isGoogleLoginMessage, isSilentReauthMessage } from './types';
import type { BackgroundMessage, GoogleLoginResponse, SilentReauthResponse } from './types';
import { handleGoogleLogin } from './handlers/oauth';

console.log('[Background] Service worker initialized');

/**
 * Message handler for popup -> background communication
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Type guard: ensure message has a type property
    if (!message || typeof message !== 'object' || !('type' in message)) {
      sendResponse({
        success: false,
        error: 'Invalid message format',
      });
      return false;
    }

    // At this point, message is an object with a type property
    // Cast to BackgroundMessage for type-safe handling
    const typedMessage = message as BackgroundMessage;
    console.log('[Background] Message received:', typedMessage.type);

    // Handle Google Login
    if (isGoogleLoginMessage(typedMessage)) {
      console.log('[Background] Handling Google login request');

      // Handle async OAuth flow
      handleGoogleLogin()
        .then((response: GoogleLoginResponse) => {
          console.log('[Background] Sending OAuth response to popup');
          sendResponse(response);
        })
        .catch((error: unknown) => {
          console.error('[Background] OAuth handler error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
          });
        });

      // Return true to indicate async response
      return true;
    }

    // Handle Silent Reauth (when token expires - 5004 error)
    if (isSilentReauthMessage(typedMessage)) {
      console.log('[Background] Handling silent reauth request (token expired)');

      // Reuse Google OAuth flow for silent reauth
      handleGoogleLogin()
        .then((response: GoogleLoginResponse) => {
          console.log('[Background] Silent reauth completed:', response.success);
          const reauthResponse: SilentReauthResponse = {
            success: response.success,
            error: response.success ? undefined : (response as { error?: string }).error,
          };
          sendResponse(reauthResponse);
        })
        .catch((error: unknown) => {
          console.error('[Background] Silent reauth error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : '재인증에 실패했습니다.',
          } as SilentReauthResponse);
        });

      return true;
    }

    // Unknown message type
    const unknownType = (message as { type: string }).type;
    console.warn('[Background] Unknown message type:', unknownType);
    sendResponse({
      success: false,
      error: `Unknown message type: ${unknownType}`,
    });

    return false;
  }
);

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('[Background] First install - welcome!');
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated');
  }
});

/**
 * Keep service worker alive (optional, for debugging)
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser started, service worker activated');
});

/**
 * Badge update for todo count
 */
function updateBadge(count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#00913A' });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Initialize badge on service worker start
chrome.storage.local.get('todoCount', (data) => {
  updateBadge(data.todoCount || 0);
});

// Listen for todoCount changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.todoCount) {
    updateBadge(changes.todoCount.newValue || 0);
  }
});

// Export for type checking (not used at runtime)
export type { BackgroundMessage, GoogleLoginResponse, SilentReauthResponse };
export { BackgroundMessageType };
