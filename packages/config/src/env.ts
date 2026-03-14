import {
  DEFAULT_EXTENSION_ID,
  DEFAULT_EXTENSION_URL,
  DEFAULT_SITE_URL,
} from "./constants";

type EnvValue = string | undefined;
type EnvSource = Record<string, EnvValue>;

function readValue(env: EnvSource, key: string, fallback: string): string {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export function readSiteEnv(env: EnvSource) {
  return {
    siteUrl: readValue(env, "NEXT_PUBLIC_SITE_URL", DEFAULT_SITE_URL),
    extensionUrl: readValue(
      env,
      "NEXT_PUBLIC_EXTENSION_URL",
      DEFAULT_EXTENSION_URL,
    ),
    extensionId: readValue(
      env,
      "NEXT_PUBLIC_EXTENSION_ID",
      DEFAULT_EXTENSION_ID,
    ),
  };
}

export function readAuthEnv(env: EnvSource) {
  return {
    authSecret: env.AUTH_SECRET?.trim() || "",
    googleClientId: env.AUTH_GOOGLE_ID?.trim() || "",
    googleClientSecret: env.AUTH_GOOGLE_SECRET?.trim() || "",
  };
}

export function readExtensionEnv(env: EnvSource) {
  const siteUrl = readValue(env, "VITE_SITE_URL", DEFAULT_SITE_URL);

  return {
    environment: env.VITE_ENVIRONMENT?.trim() || "development",
    siteUrl,
    webBaseUrl: readValue(env, "VITE_WEB_BASE_URL", siteUrl),
    gaApiSecret: env.VITE_GA_API_SECRET?.trim() || "",
    apiBaseUrl: env.VITE_API_BASE_URL?.trim() || "",
  };
}
