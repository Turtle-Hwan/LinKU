import {
  DEFAULT_APP_URL,
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
    appUrl: readValue(env, "NEXT_PUBLIC_APP_URL", DEFAULT_APP_URL),
    extensionUrl: readValue(
      env,
      "NEXT_PUBLIC_EXTENSION_URL",
      DEFAULT_EXTENSION_URL,
    ),
  };
}

export function readAppEnv(env: EnvSource) {
  return {
    siteUrl: readValue(env, "NEXT_PUBLIC_SITE_URL", DEFAULT_SITE_URL),
    appUrl: readValue(env, "NEXT_PUBLIC_APP_URL", DEFAULT_APP_URL),
    extensionId: env.NEXT_PUBLIC_EXTENSION_ID?.trim() || "",
  };
}

export function readExtensionEnv(env: EnvSource) {
  return {
    environment: env.VITE_ENVIRONMENT?.trim() || "development",
    siteUrl: readValue(env, "VITE_SITE_URL", DEFAULT_SITE_URL),
    appUrl: readValue(env, "VITE_WEB_APP_URL", DEFAULT_APP_URL),
    gaApiSecret: env.VITE_GA_API_SECRET?.trim() || "",
    apiBaseUrl: env.VITE_API_BASE_URL?.trim() || "",
  };
}
