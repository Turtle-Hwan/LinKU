import { DEFAULT_SITE_URL } from "@linku/config";
import { buildWebUrl, ensureTrailingSlash } from "@linku/platform";

export const IMAGE_URL = ensureTrailingSlash(
  import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);

export const WEB_BASE_URL =
  import.meta.env.VITE_WEB_BASE_URL ||
  import.meta.env.VITE_SITE_URL ||
  DEFAULT_SITE_URL;

export const WEB_LOGIN_URL = buildWebUrl("/login", WEB_BASE_URL);
