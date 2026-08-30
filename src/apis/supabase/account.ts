import { getSupabaseClient } from "@/apis/supabase/client";
import {
  toSupabaseAuthError,
  toSupabaseUserError,
} from "@/apis/supabase/errors";
import type { AccountProfile } from "@/types/account";
import { UserFacingError } from "@/errors/userFacingError";

function isGoogleUser(appMetadata: Record<string, unknown>): boolean {
  if (appMetadata.provider === "google") return true;
  return Array.isArray(appMetadata.providers) &&
    appMetadata.providers.includes("google");
}

export async function getGoogleAccountId(): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw toSupabaseAuthError(error, "계정 정보를 불러오지 못했습니다.");
  const user = data.session?.user;
  return user && isGoogleUser(user.app_metadata) ? user.id : null;
}

export async function getAccountProfile(): Promise<AccountProfile | null> {
  const client = getSupabaseClient();
  const userId = await getGoogleAccountId();
  if (!userId) return null;

  const { data, error } = await client
    .from("profiles")
    .select("nickname")
    .eq("user_id", userId)
    .single();
  if (error) throw toSupabaseUserError(error, "계정 정보를 불러오지 못했습니다.");
  return { userId, nickname: data.nickname };
}

export async function updateAccountNickname(
  nickname: string,
): Promise<AccountProfile> {
  const client = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    throw toSupabaseAuthError(sessionError, "계정 정보를 불러오지 못했습니다.");
  }
  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new UserFacingError("Google 로그인이 필요합니다.", "LOGIN_REQUIRED");
  }

  const { data, error } = await client.rpc("update_nickname", {
    p_nickname: nickname,
  });
  if (error) throw toSupabaseUserError(error, "닉네임을 저장하지 못했습니다.");
  return { userId, nickname: data.nickname };
}

export async function signOutAccount(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
  if (error) throw toSupabaseAuthError(error, "로그아웃을 완료하지 못했습니다.");
}
