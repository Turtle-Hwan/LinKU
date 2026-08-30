import {
  getAccountProfile,
  getGoogleAccountId,
  signOutAccount,
} from "@/apis/supabase/account";
import {
  clearStoredSupabaseSession,
  SupabaseConfigurationError,
} from "@/apis/supabase/client";
import { BackgroundMessageType, type GoogleLoginResponse } from "@/background/types";
import {
  activateSyncAccount,
  SyncAccountMismatchError,
} from "@/storage/account/syncRepository";
import type { AccountProfile } from "@/types/account";
import { getChromeApi } from "@/utils/chrome";
import { captureErrorLog } from "@/utils/logger";
import { recordBreadcrumb } from "@/monitoring";

export type UserProfile = AccountProfile;

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    return await getAccountProfile();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return null;
    throw error;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    return (await getGoogleAccountId()) !== null;
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return false;
    throw error;
  }
}

export async function startGoogleLogin(): Promise<GoogleLoginResponse> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.runtime?.sendMessage) {
    return {
      success: false,
      error: "Google 로그인은 설치된 LinKU 확장에서 사용할 수 있습니다.",
    };
  }

  try {
    const response = (await chromeApi.runtime.sendMessage({
      type: BackgroundMessageType.GOOGLE_LOGIN,
    })) as GoogleLoginResponse;
    if (!response.success) return response;

    try {
      await activateSyncAccount(response.profile.userId);
    } catch (error) {
      await signOutAccount().catch(() => clearStoredSupabaseSession());
      if (error instanceof SyncAccountMismatchError) {
        recordBreadcrumb(
          "account.sync",
          "login blocked by a different local sync binding",
          undefined,
          "warning",
        );
        return { success: false, error: error.message };
      }
      throw error;
    }

    window.dispatchEvent(
      new CustomEvent("auth:login", { detail: response.profile }),
    );
    return response;
  } catch (error) {
    captureErrorLog("[Popup] Failed to complete Google login", error);
    return {
      success: false,
      error: "로그인을 완료하지 못했습니다.",
    };
  }
}

export async function logout(): Promise<void> {
  try {
    await signOutAccount();
  } finally {
    await clearStoredSupabaseSession();
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }
}
