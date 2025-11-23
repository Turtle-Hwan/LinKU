/**
 * OAuth utilities for Chrome Extension - Popup Context
 * Handles Google OAuth flow by communicating with background service worker
 *
 * Note: chrome.identity API is NOT available in popup context.
 * All OAuth flows are handled by the background service worker.
 */

import { BackgroundMessageType } from '../background/types';
import type { GoogleLoginResponse } from '../background/types';

/**
 * User profile stored in chrome.storage.local
 */
export interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

/**
 * Get access token from chrome.storage.local
 */
export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(['accessToken']);
  return result.accessToken || null;
}

/**
 * Get user profile from chrome.storage.local
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const result = await chrome.storage.local.get(['userProfile']);
  return result.userProfile || null;
}


/**
 * Clear all tokens and user profile from chrome.storage.local
 */
export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(['accessToken', 'refreshToken', 'guestToken', 'userProfile']);
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

/**
 * Google OAuth login flow
 * Sends message to background service worker to handle OAuth
 *
 * Background service worker has access to chrome.identity API
 */
export async function startGoogleLogin(): Promise<GoogleLoginResponse> {
  try {
    console.log('[Popup] Sending Google login request to background');

    // Send message to background service worker
    const response = await chrome.runtime.sendMessage({
      type: BackgroundMessageType.GOOGLE_LOGIN,
    });

    console.log('[Popup] Received response from background:', response);

    return response as GoogleLoginResponse;
  } catch (error) {
    console.error('[Popup] Failed to communicate with background:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : '백그라운드와 통신 중 오류가 발생했습니다.',
    };
  }
}

/**
 * Logout - clear all tokens
 */
export async function logout(): Promise<void> {
  await clearTokens();
  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('auth:logout'));
}
