/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT?: string;
  readonly VITE_GA_API_SECRET?: string;
  readonly VITE_GA_PROXY_URL?: string;
  readonly VITE_VOC_ENDPOINT?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_SENTRY_SMOKE_TEST?: string;
}
