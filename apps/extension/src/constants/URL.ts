import { DEFAULT_SITE_URL } from "@linku/config";
import { ensureTrailingSlash } from "@linku/platform";

export const IMAGE_URL = ensureTrailingSlash(
  import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);
