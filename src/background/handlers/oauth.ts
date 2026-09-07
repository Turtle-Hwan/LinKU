import type { GoogleLoginResponse } from "../types";
import { initializeAccountProfile } from "@/apis/supabase/account";
import { toSupabaseAuthError } from "@/apis/supabase/errors";
import {
  clearLegacyAuthStorage,
  clearStoredSupabaseSession,
  getSupabaseClient,
  SupabaseConfigurationError,
} from "@/apis/supabase/client";
import { recordBreadcrumb } from "@/monitoring";
import { captureErrorLog, captureWarnLog, debugLog } from "@/utils/logger";
import { withAccountLock } from "@/utils/accountLock";
import {
  activateSyncAccount,
  SyncAccountMismatchError,
} from "@/storage/account/syncRepository";

function isUserCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /did not approve|closed|cancell?ed|interrupted|access_denied/iu.test(
    message,
  );
}

function expectedCallbackMatches(responseUrl: URL, redirectUri: string): boolean {
  const expected = new URL(redirectUri);
  return (
    responseUrl.origin === expected.origin &&
    responseUrl.pathname === expected.pathname
  );
}

let activeLogin: Promise<GoogleLoginResponse> | null = null;

async function performGoogleLogin(): Promise<GoogleLoginResponse> {
  try {
    const client = getSupabaseClient();
    const redirectUri = chrome.identity.getRedirectURL("supabase");
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      throw toSupabaseAuthError(error, "Google 로그인을 시작하지 못했습니다.");
    }
    if (!data.url) throw new Error("OAUTH_URL_MISSING");

    const response = await chrome.identity.launchWebAuthFlow({
      url: data.url,
      interactive: true,
    });
    if (!response) {
      recordBreadcrumb(
        "oauth.outcome",
        "OAuth flow ended without a redirect URL",
        undefined,
        "info",
      );
      return { success: false, error: "사용자가 인증을 취소했습니다." };
    }

    const callback = new URL(response);
    if (!expectedCallbackMatches(callback, redirectUri)) {
      captureErrorLog("[Background] OAuth callback origin verification failed");
      return { success: false, error: "로그인 응답을 확인하지 못했습니다." };
    }

    const providerError = callback.searchParams.get("error");
    if (providerError) {
      const expected = /access_denied|cancel|closed/iu.test(providerError);
      recordBreadcrumb(
        "oauth.outcome",
        "OAuth provider returned an error outcome",
        { oauth_error: providerError, expected },
        expected ? "info" : "error",
      );
      if (expected) {
        return { success: false, error: "사용자가 인증을 취소했습니다." };
      }
      captureErrorLog(
        "[Background] OAuth provider returned an unexpected error",
        new Error(`OAuth provider error: ${providerError}`),
      );
      return { success: false, error: "Google 로그인을 완료하지 못했습니다." };
    }

    const code = callback.searchParams.get("code");
    if (!code) {
      captureErrorLog("[Background] OAuth callback did not include a code");
      return { success: false, error: "로그인 응답을 확인하지 못했습니다." };
    }

    return await withAccountLock(async () => {
      try {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw toSupabaseAuthError(exchangeError, "Google 로그인을 완료하지 못했습니다.");
        }
        const profile = await initializeAccountProfile();
        if (!profile) throw new Error("GOOGLE_ACCOUNT_REQUIRED");
        // The popup may close while the identity window is open.
        await activateSyncAccount(profile.userId);
        await clearLegacyAuthStorage();
        debugLog("[Background] Google session established");
        return { success: true, profile };
      } catch (error) {
        await client.auth.signOut({ scope: "local" }).catch(() => undefined);
        await clearStoredSupabaseSession();
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof SyncAccountMismatchError) {
      recordBreadcrumb("account.sync", "login blocked by local account binding", undefined, "warning");
      return { success: false, error: error.message };
    }
    if (isUserCancellation(error)) {
      recordBreadcrumb(
        "oauth.outcome",
        "OAuth flow cancelled by user",
        undefined,
        "info",
      );
      return { success: false, error: "사용자가 인증을 취소했습니다." };
    }
    if (error instanceof SupabaseConfigurationError) {
      captureWarnLog("[Background] Supabase auth is not configured");
      return {
        success: false,
        error: "로그인 기능을 준비 중입니다.",
      };
    }
    captureErrorLog("[Background] Google OAuth failed", error);
    return {
      success: false,
      error: "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

export function handleGoogleLogin(): Promise<GoogleLoginResponse> {
  if (!activeLogin) {
    activeLogin = performGoogleLogin().finally(() => {
      activeLogin = null;
    });
  }
  return activeLogin;
}
