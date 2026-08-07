import {
  DEFAULT_EXTENSION_URL,
  DEFAULT_SITE_URL,
} from "@linku/config";

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

export function buildSiteUrl(path = "/", siteUrl = DEFAULT_SITE_URL): string {
  return new URL(path, ensureTrailingSlash(normalizeBaseUrl(siteUrl))).toString();
}

export function buildWebUrl(path = "/", siteUrl = DEFAULT_SITE_URL): string {
  return buildSiteUrl(path, siteUrl);
}

export function buildInstallUrl(extensionUrl = DEFAULT_EXTENSION_URL): string {
  return extensionUrl;
}

export function normalizeExternalHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeInternalAppPath(value: string) {
  const path = value.trim();
  const hasControlCharacters = Array.from(path).some(
    (character) => character.charCodeAt(0) < 32,
  );
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    hasControlCharacters
  ) {
    return null;
  }

  return path;
}
