/**
 * Background Service Worker for LinKU Chrome Extension
 *
 * This service worker handles:
 * - Google OAuth authentication (chrome.identity API)
 * - Message passing between popup and background
 *
 * Note: chrome.identity API is ONLY available in background/service worker context
 */

import { BackgroundMessageType, isGoogleLoginMessage } from './types';
import type { BackgroundMessage, GoogleLoginResponse } from './types';
import { handleGoogleLogin } from './handlers/oauth';

console.log('[Background] Service worker initialized');

/**
 * Message handler for popup -> background communication
 */
chrome.runtime.onMessage.addListener(
  (
    message: any,
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

    console.log('[Background] Message received:', message.type);

    // Handle Google Login
    if (isGoogleLoginMessage(message)) {
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

    // Unknown message type
    console.warn('[Background] Unknown message type:', message.type);
    sendResponse({
      success: false,
      error: `Unknown message type: ${message.type}`,
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

// Export for type checking (not used at runtime)
export type { BackgroundMessage, GoogleLoginResponse };
export { BackgroundMessageType };
