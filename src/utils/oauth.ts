/**
 * OAuth utilities for Chrome Extension - Popup Context
 * Handles Google OAuth flow by communicating with background service worker
 *
 * Note: chrome.identity API is NOT available in popup context.
 * All OAuth flows are handled by the background service worker.
 */

import { BackgroundMessageType } from "../background/types";
import type { GoogleLoginResponse } from "../background/types";
import { getChromeApi, getStorage, removeStorage } from "./chrome";
import { debugLog, errorLog, getErrorLogDetails } from "@/utils/logger";

/**
 * User profile stored in chrome.storage.local
 */
export interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Record<string, unknown>;
  return (
    typeof profile.email === "string" &&
    typeof profile.name === "string" &&
    typeof profile.picture === "string"
  );
}

/**
 * Get access token from chrome.storage.local
 */
export async function getAccessToken(): Promise<string | null> {
  const token = await getStorage<unknown>("accessToken");
  return typeof token === "string" ? token : null;
}

/**
 * Get user profile from chrome.storage.local
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const profile = await getStorage<unknown>("userProfile");
  return isUserProfile(profile) ? profile : null;
}

/**
 * Clear all tokens and user profile from chrome.storage.local
 */
export async function clearTokens(): Promise<void> {
  await removeStorage([
    "accessToken",
    "refreshToken",
    "guestToken",
    "userProfile",
    "isGuest",
    "kuMail",
  ]);
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

/**
 * Check if current user is a guest (needs email verification)
 */
export async function isGuestUser(): Promise<boolean> {
  const isGuest = await getStorage<boolean>("isGuest");
  const refreshToken = await getStorage<string>("refreshToken");
  // Guest if isGuest flag is true OR no refreshToken
  return isGuest === true || !refreshToken;
}

/**
 * Google OAuth login flow
 * Sends message to background service worker to handle OAuth
 *
 * Background service worker has access to chrome.identity API
 */
export async function startGoogleLogin(): Promise<GoogleLoginResponse> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.runtime?.sendMessage) {
    return {
      success: false,
      error: "Chrome extension environment is unavailable.",
    };
  }

  try {
    debugLog("[Popup] Sending Google login request to background");

    // Send message to background service worker
    const response = await chromeApi.runtime.sendMessage({
      type: BackgroundMessageType.GOOGLE_LOGIN,
    });

    return response as GoogleLoginResponse;
  } catch (error) {
    errorLog(
      "[Popup] Failed to communicate with background",
      getErrorLogDetails(error),
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "백그라운드와 통신 중 오류가 발생했습니다.",
    };
  }
}

/**
 * Logout - clear all tokens
 */
export async function logout(): Promise<void> {
  await clearTokens();
  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent("auth:logout"));
}
