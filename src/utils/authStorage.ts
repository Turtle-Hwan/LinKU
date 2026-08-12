import type { AuthSessionResponse } from "@/types/serverless";

export const ACCOUNT_ACCESS_TOKEN_KEY = "linkuAccountAccessToken";
export const ACCOUNT_ACCESS_TOKEN_EXPIRES_AT_KEY =
  "linkuAccountAccessTokenExpiresAt";
export const ACCOUNT_REFRESH_TOKEN_KEY = "linkuAccountRefreshToken";
export const ACCOUNT_PROFILE_KEY = "linkuAccountProfile";
export const ACCOUNT_ID_KEY = "linkuAccountId";

const SESSION_AUTH_KEYS = [
  ACCOUNT_ACCESS_TOKEN_KEY,
  ACCOUNT_ACCESS_TOKEN_EXPIRES_AT_KEY,
] as const;
const LOCAL_AUTH_KEYS = [
  ACCOUNT_REFRESH_TOKEN_KEY,
  ACCOUNT_PROFILE_KEY,
  ACCOUNT_ID_KEY,
] as const;
const LEGACY_SESSION_AUTH_KEYS = ["accessToken", "accessTokenExpiresAt"] as const;
const LEGACY_LOCAL_AUTH_KEYS = [
  "accessToken",
  "refreshToken",
  "userProfile",
  "syncAccountId",
  "guestToken",
  "isGuest",
  "kuMail",
] as const;

export async function saveAuthSession(
  session: AuthSessionResponse,
): Promise<void> {
  await Promise.all([
    chrome.storage.session.set({
      [ACCOUNT_ACCESS_TOKEN_KEY]: session.accessToken,
      [ACCOUNT_ACCESS_TOKEN_EXPIRES_AT_KEY]: session.expiresAt,
    }),
    chrome.storage.local.set({
      [ACCOUNT_REFRESH_TOKEN_KEY]: session.refreshToken,
      [ACCOUNT_PROFILE_KEY]: session.profile,
      [ACCOUNT_ID_KEY]: session.accountId,
    }),
    chrome.storage.session.remove([...LEGACY_SESSION_AUTH_KEYS]),
    chrome.storage.local.remove([...LEGACY_LOCAL_AUTH_KEYS]),
  ]);
}

export async function clearStoredAuth(): Promise<void> {
  await Promise.all([
    chrome.storage.session.remove([
      ...SESSION_AUTH_KEYS,
      ...LEGACY_SESSION_AUTH_KEYS,
    ]),
    chrome.storage.local.remove([
      ...LOCAL_AUTH_KEYS,
      ...LEGACY_LOCAL_AUTH_KEYS,
    ]),
  ]);
}
