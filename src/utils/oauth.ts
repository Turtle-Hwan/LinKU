import { BackgroundMessageType } from "@/background/types";
import type { GoogleLoginResponse } from "@/background/types";
import type { AuthProfile } from "@/types/serverless";
import {
  ACCOUNT_ACCESS_TOKEN_KEY,
  ACCOUNT_PROFILE_KEY,
  ACCOUNT_REFRESH_TOKEN_KEY,
  clearStoredAuth,
} from "@/utils/authStorage";
import { debugLog, errorLog, getErrorLogDetails } from "@/utils/logger";

export type UserProfile = AuthProfile;

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.email === "string" &&
    typeof profile.name === "string" &&
    typeof profile.picture === "string"
  );
}

export async function getAccessToken(): Promise<string | null> {
  const stored = await chrome.storage.session.get(ACCOUNT_ACCESS_TOKEN_KEY);
  const token = stored[ACCOUNT_ACCESS_TOKEN_KEY];
  return typeof token === "string" ? token : null;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const stored = await chrome.storage.local.get(ACCOUNT_PROFILE_KEY);
  const profile = stored[ACCOUNT_PROFILE_KEY];
  return isUserProfile(profile) ? profile : null;
}

export async function clearTokens(): Promise<void> {
  await clearStoredAuth();
}

export async function isLoggedIn(): Promise<boolean> {
  const [token, local] = await Promise.all([
    getAccessToken(),
    chrome.storage.local.get(ACCOUNT_REFRESH_TOKEN_KEY),
  ]);
  return Boolean(
    token || typeof local[ACCOUNT_REFRESH_TOKEN_KEY] === "string",
  );
}

export async function startGoogleLogin(): Promise<GoogleLoginResponse> {
  try {
    debugLog("[Popup] Sending Google login request to background");
    return (await chrome.runtime.sendMessage({
      type: BackgroundMessageType.GOOGLE_LOGIN,
    })) as GoogleLoginResponse;
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

export async function logout(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: BackgroundMessageType.LOGOUT });
  } finally {
    await clearTokens();
  }
  window.dispatchEvent(new CustomEvent("auth:logout"));
}
