/**
 * Google OAuth Handler for Chrome Extension
 *
 * 백엔드 API 스펙 (PR #26):
 * 1. GET /api/oauth2/google?redirectUri={uri} - Google OAuth 페이지로 리다이렉트
 * 2. GET /api/oauth2/google/login?redirectUri={uri}&code={code} - 토큰 교환
 *
 * 응답 형식:
 * {
 *   "code": 1000,
 *   "message": "SUCCESS",
 *   "result": {
 *     "accessToken": "token_here",
 *     "refreshToken": "refresh_or_null"
 *   }
 * }
 */

import type { GoogleLoginResponse } from "../types";

// Backend URL from environment
const BACKEND_URL = (() => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) return "";

  try {
    const url = new URL(baseUrl);
    if (url.pathname.endsWith("/api")) {
      url.pathname = url.pathname.slice(0, -4);
    }
    const result = url.origin + url.pathname;
    return result.endsWith("/") ? result.slice(0, -1) : result;
  } catch {
    const result = baseUrl.replace("/api", "");
    return result.endsWith("/") ? result.slice(0, -1) : result;
  }
})();

/**
 * Save tokens and auth state to chrome.storage.local
 */
async function saveTokens(
  accessToken: string,
  refreshToken?: string | null
): Promise<void> {
  const isGuest = !refreshToken;
  const data: Record<string, string | boolean> = {
    accessToken,
    isGuest,
  };
  if (refreshToken) {
    data.refreshToken = refreshToken;
  }
  await chrome.storage.local.set(data);
}

/**
 * Handle Google OAuth Login
 * Uses chrome.identity.launchWebAuthFlow for OAuth flow
 */
export async function handleGoogleLogin(): Promise<GoogleLoginResponse> {
  try {
    console.log("[Background] Starting Google OAuth flow");

    // 1. Get extension ID and construct redirect URI
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;

    console.log("[Background] Extension ID:", extensionId);
    console.log("[Background] Redirect URI:", redirectUri);
    console.log("[Background] Backend URL:", BACKEND_URL);

    if (!BACKEND_URL) {
      return {
        success: false,
        error: "Backend URL이 설정되지 않았습니다. 환경 변수를 확인해주세요.",
      };
    }

    // 2. Construct OAuth URL (새 API 스펙)
    const authUrl = new URL(`${BACKEND_URL}/api/oauth2/google`);
    authUrl.searchParams.set("redirectUri", redirectUri);

    console.log("[Background] Auth URL:", authUrl.toString());

    // 3. Launch OAuth flow using chrome.identity API
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    console.log("[Background] Response URL:", responseUrl);

    if (!responseUrl) {
      return { success: false, error: "인증이 취소되었습니다." };
    }

    // 4. Parse response URL to extract code
    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    console.log("[Background] Extracted code:", code ? "있음" : "없음");

    if (error) {
      console.error("[Background] OAuth error:", error);
      return {
        success: false,
        error: `OAuth 오류: ${error}`,
      };
    }

    if (!code) {
      return {
        success: false,
        error: "인증 코드를 받지 못했습니다.",
      };
    }

    // 5. Exchange code for token via backend (새 API 스펙)
    console.log("[Background] Exchanging code for token...");

    const tokenUrl = new URL(`${BACKEND_URL}/api/oauth2/google/login`);
    tokenUrl.searchParams.set("redirectUri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    console.log("[Background] Token URL:", tokenUrl.toString());

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    console.log("[Background] Token Response Status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Background] Token exchange failed:", errorText);
      return {
        success: false,
        error: `토큰 교환 실패: ${tokenResponse.status} ${tokenResponse.statusText}`,
      };
    }

    const tokenData = await tokenResponse.json();
    console.log("[Background] Token Data:", JSON.stringify(tokenData, null, 2));

    // 6. Parse backend response
    // 응답 형식: { code: 1000, message: "SUCCESS", result: { accessToken, refreshToken } }
    if (tokenData.code !== 1000) {
      return {
        success: false,
        error: tokenData.message || "토큰 교환에 실패했습니다.",
      };
    }

    const { accessToken, refreshToken } = tokenData.result || {};

    if (!accessToken) {
      console.error("[Background] No accessToken in response:", tokenData);
      return {
        success: false,
        error: "백엔드 응답에서 토큰을 찾을 수 없습니다.",
      };
    }

    // 7. Save tokens
    await saveTokens(accessToken, refreshToken);
    console.log("[Background] Tokens saved successfully");

    // 8. Return success response
    // refreshToken이 없으면 게스트(신규 회원)
    const isGuest = !refreshToken;

    return {
      success: true,
      response: {
        guestToken: accessToken,
        requiresSignup: isGuest,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          email: "",
          name: "",
          picture: "",
        },
      },
    };
  } catch (error) {
    console.error("[Background] OAuth error:", error);

    // User closed the popup or cancelled
    if (error instanceof Error) {
      if (
        error.message.includes("The user did not approve") ||
        error.message.includes("closed") ||
        error.message.includes("cancelled")
      ) {
        return {
          success: false,
          error: "사용자가 인증을 취소했습니다.",
        };
      }

      // Authorization page could not be loaded
      if (error.message.includes("Authorization page could not be loaded")) {
        return {
          success: false,
          error:
            "인증 페이지를 로드할 수 없습니다. 백엔드 서버 상태를 확인해주세요.",
        };
      }

      // Interrupted
      if (error.message.includes("interrupted")) {
        return {
          success: false,
          error: "로그인이 중단되었습니다.",
        };
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
