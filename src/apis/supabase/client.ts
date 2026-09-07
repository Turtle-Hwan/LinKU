import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const AUTH_STORAGE_KEY = "linku.supabase.auth.v1";
const LEGACY_AUTH_KEYS = [
  "accessToken",
  "accessTokenExpiresAt",
  "refreshToken",
  "guestToken",
  "isGuest",
  "kuMail",
  "userProfile",
  "syncAccountId",
] as const;

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase 연결 정보가 설정되지 않았습니다.");
    this.name = "SupabaseConfigurationError";
  }
}

const extensionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (globalThis.chrome?.storage?.local) {
      const stored = await chrome.storage.local.get(key);
      return typeof stored[key] === "string" ? stored[key] : null;
    }
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.set({ [key]: value });
      return;
    }
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.remove(key);
      return;
    }
    globalThis.localStorage?.removeItem(key);
  },
};

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new SupabaseConfigurationError();

  client = createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage: extensionStorage,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.trim() &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export async function clearLegacyAuthStorage(): Promise<void> {
  if (!globalThis.chrome?.storage?.local) return;
  await chrome.storage.local.remove([...LEGACY_AUTH_KEYS]);
}

export async function clearStoredSupabaseSession(): Promise<void> {
  await extensionStorage.removeItem(AUTH_STORAGE_KEY);
}
