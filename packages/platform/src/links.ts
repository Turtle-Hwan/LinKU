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
