import * as Sentry from "@sentry/browser";
import type { ErrorEvent as SentryErrorEvent } from "@sentry/browser";

export type SentryRuntime = "popup" | "background" | "content";

type CaptureOptions = {
  feature?: string;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
};

const SENSITIVE_KEY_PATTERN =
  /access.?token|refresh.?token|guest.?token|id.?token|authorization|cookie|password|secret|api.?key|email|session/i;
const SENSITIVE_QUERY_PATTERN =
  /^(access_token|refresh_token|guest_token|id_token|authorization|code|state|session|token|key|email|user_email|student_email|user_id|student_id)$/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[^\s]+/gi;
const QUERY_VALUE_PATTERN =
  /([?&](?:access_token|refresh_token|guest_token|id_token|authorization|code|state|session|token|key)=)[^&#\s]*/gi;

let activeRuntime: SentryRuntime | undefined;
let sentryReady = false;

function redactString(value: string): string {
  return value
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .replace(QUERY_VALUE_PATTERN, "$1[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

function redactUrl(value?: string): string | undefined {
  if (!value) {
    return value;
  }

  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_PATTERN.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return redactString(url.toString());
  } catch {
    return "[REDACTED_URL]";
  }
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  if (typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : /^(url|uri|href)$/i.test(key) && typeof item === "string"
          ? redactUrl(item)
          : scrubValue(item, depth + 1),
    ]),
  );
}

function scrubEvent(event: SentryErrorEvent): SentryErrorEvent {
  delete event.user;

  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    event.request.url = redactUrl(event.request.url);
  }

  if (event.message) {
    event.message = redactString(event.message);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception.value ? redactString(exception.value) : exception.value,
    }));
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb.message
        ? redactString(breadcrumb.message)
        : breadcrumb.message,
      data: breadcrumb.data
        ? (scrubValue(breadcrumb.data) as Record<string, unknown>)
        : breadcrumb.data,
    }));
  }

  return event;
}

function getExtensionVersion(): string | undefined {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return undefined;
  }
}

function getReleaseName(version?: string): string | undefined {
  const configuredRelease = import.meta.env.VITE_SENTRY_RELEASE?.trim();
  if (configuredRelease) {
    return configuredRelease;
  }

  return version ? `linku@${version}` : undefined;
}

export function initSentry(runtime: SentryRuntime): void {
  if (sentryReady) {
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const version = getExtensionVersion();
  activeRuntime = runtime;

  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
      (import.meta.env.DEV ? "development" : "production"),
    release: getReleaseName(version),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb(breadcrumb) {
      return {
        ...breadcrumb,
        message: breadcrumb.message
          ? redactString(breadcrumb.message)
          : breadcrumb.message,
        data: breadcrumb.data
          ? (scrubValue(breadcrumb.data) as Record<string, unknown>)
          : breadcrumb.data,
      };
    },
  });

  Sentry.setTags({
    linku_runtime: runtime,
    ...(version ? { linku_extension_version: version } : {}),
  });
  sentryReady = true;

  if (import.meta.env.VITE_SENTRY_SMOKE_TEST === "true") {
    Sentry.captureMessage(`LinKU Sentry smoke test: ${runtime}`, "warning");
    void Sentry.flush();
  }
}

export function captureSentryException(
  error: unknown,
  options: CaptureOptions = {},
): void {
  if (!sentryReady) {
    return;
  }

  Sentry.withScope((scope) => {
    if (activeRuntime) {
      scope.setTag("linku_runtime", activeRuntime);
    }
    if (options.feature) {
      scope.setTag("linku_feature", options.feature);
    }
    if (options.tags) {
      scope.setTags(scrubValue(options.tags) as Record<string, string>);
    }
    if (options.extras) {
      scope.setExtras(scrubValue(options.extras) as Record<string, unknown>);
    }
    Sentry.captureException(error);
  });
}

export function flushSentry(timeout = 2_000): Promise<boolean> {
  return sentryReady ? Sentry.flush(timeout) : Promise.resolve(true);
}
