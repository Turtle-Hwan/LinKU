import type { GoogleLoginResponse, SilentReauthResponse } from "../types";
import type { ApiResult, AuthSessionResponse } from "@/types/serverless";
import {
  ACCOUNT_ACCESS_TOKEN_EXPIRES_AT_KEY,
  ACCOUNT_ACCESS_TOKEN_KEY,
  ACCOUNT_REFRESH_TOKEN_KEY,
  clearStoredAuth,
  saveAuthSession,
} from "@/utils/authStorage";
import { debugLog, errorLog, getErrorLogDetails } from "@/utils/logger";

export const ACCOUNT_API_BASE_URL = "https://linku.turtlehwan.dev/api";

let refreshPromise: Promise<boolean> | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  return base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  );
}

async function getDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get("linkuDeviceId");
  if (typeof stored.linkuDeviceId === "string") return stored.linkuDeviceId;
  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ linkuDeviceId: deviceId });
  return deviceId;
}

async function readSessionResult(
  response: Response,
): Promise<ApiResult<AuthSessionResponse>> {
  try {
    return (await response.json()) as ApiResult<AuthSessionResponse>;
  } catch {
    return {
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "계정 서버 응답을 읽지 못했습니다.",
        retryable: true,
        requestId: "unavailable",
      },
    };
  }
}

export async function handleGoogleLogin(): Promise<GoogleLoginResponse> {
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    const verifier = randomVerifier();
    const state = randomVerifier();
    const authUrl = new URL(`${ACCOUNT_API_BASE_URL}/auth/google/start`);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("code_challenge", await challengeFor(verifier));
    authUrl.searchParams.set("state", state);

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });
    if (!responseUrl) return { success: false, error: "인증이 취소되었습니다." };

    const callback = new URL(responseUrl);
    const providerError = callback.searchParams.get("error");
    const code = callback.searchParams.get("code");
    if (providerError) {
      return {
        success: false,
        error:
          providerError === "access_denied"
            ? "사용자가 인증을 취소했습니다."
            : "Google 로그인을 완료하지 못했습니다.",
      };
    }
    if (!code || callback.searchParams.get("state") !== state) {
      return { success: false, error: "인증 응답을 확인하지 못했습니다." };
    }

    const response = await fetch(`${ACCOUNT_API_BASE_URL}/auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        verifier,
        deviceId: await getDeviceId(),
      }),
    });
    const result = await readSessionResult(response);
    if (!result.ok) return { success: false, error: result.error.message };
    await saveAuthSession(result.data);
    debugLog("[Background] Google session saved");
    return { success: true, profile: result.data.profile };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("did not approve") ||
      message.includes("closed") ||
      message.includes("cancelled") ||
      message.includes("interrupted")
    ) {
      return { success: false, error: "사용자가 인증을 취소했습니다." };
    }
    errorLog("[Background] OAuth failed", getErrorLogDetails(error));
    return { success: false, error: "로그인을 완료하지 못했습니다." };
  }
}

async function performRefresh(): Promise<boolean> {
  const stored = await chrome.storage.local.get(ACCOUNT_REFRESH_TOKEN_KEY);
  const refreshToken = stored[ACCOUNT_REFRESH_TOKEN_KEY];
  if (typeof refreshToken !== "string") return false;
  try {
    const response = await fetch(`${ACCOUNT_API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const result = await readSessionResult(response);
    if (!result.ok) {
      if (!result.error.retryable) await clearStoredAuth();
      return false;
    }
    await saveAuthSession(result.data);
    return true;
  } catch {
    return false;
  }
}

export async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function handleSilentReauth(): Promise<SilentReauthResponse> {
  const success = await refreshSession();
  return success
    ? { success: true }
    : { success: false, error: "세션이 만료되었습니다. 다시 로그인해주세요." };
}

export async function getValidAccessToken(): Promise<string | null> {
  const stored = await chrome.storage.session.get([
    ACCOUNT_ACCESS_TOKEN_KEY,
    ACCOUNT_ACCESS_TOKEN_EXPIRES_AT_KEY,
  ]);
  const accessToken = stored[ACCOUNT_ACCESS_TOKEN_KEY];
  const expiresAt = stored[ACCOUNT_ACCESS_TOKEN_EXPIRES_AT_KEY];
  if (
    typeof accessToken === "string" &&
    typeof expiresAt === "string" &&
    Date.parse(expiresAt) > Date.now() + 30_000
  ) {
    return accessToken;
  }
  if (!(await refreshSession())) return null;
  const refreshed = await chrome.storage.session.get(ACCOUNT_ACCESS_TOKEN_KEY);
  const refreshedToken = refreshed[ACCOUNT_ACCESS_TOKEN_KEY];
  return typeof refreshedToken === "string" ? refreshedToken : null;
}

export async function logoutSession(): Promise<void> {
  const token = await getValidAccessToken();
  if (token) {
    try {
      await fetch(`${ACCOUNT_API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // Local logout remains available during a Worker outage.
    }
  }
  await clearStoredAuth();
}
