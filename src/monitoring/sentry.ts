import * as Sentry from "@sentry/browser";
import type {
  Breadcrumb,
  ErrorEvent as SentryErrorEvent,
  SeverityLevel,
} from "@sentry/browser";

export type SentryRuntime = "popup" | "background" | "content";
export type SentryLevel = SeverityLevel;

export type CaptureOptions = {
  feature?: string;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
  context?: Record<string, unknown>;
  handled?: boolean;
  mechanism?: string;
};

const SENSITIVE_KEY_PATTERN =
  /access.?token|refresh.?token|guest.?token|id.?token|authorization|cookie|password|secret|api.?key|email|session|user.?id|student.?id|student.?number|phone|display.?name|full.?name/i;
const SENSITIVE_QUERY_PATTERN =
  /^(access_token|refresh_token|guest_token|id_token|authorization|code|state|session|token|key|email|user_email|student_email|user_id|student_id|phone)$/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[^\s]+/gi;
const SENSITIVE_VALUE_PATTERN =
  /((?:["']?)(?:access[_-]?token|refresh[_-]?token|guest[_-]?token|id[_-]?token|authorization|cookie|password|secret|api[_-]?key|token|code|state|user[_-]?id|student[_-]?id)(?:["']?\s*[:=]\s*))(["']?)[^"'&,\s}\]]+/gi;
const QUERY_VALUE_PATTERN =
  /([?&](?:access_token|refresh_token|guest_token|id_token|authorization|code|state|session|token|key|email|user_email|student_email|user_id|student_id|phone)=)[^&#\s]*/gi;

type RuntimeGlobal = {
  addEventListener?: (
    type: string,
    listener: (event: Event) => void,
  ) => void;
};

let activeRuntime: SentryRuntime | undefined;
let sentryReady = false;
let globalHandlersInstalled = false;

function redactString(value: string): string {
  return value
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .replace(SENSITIVE_VALUE_PATTERN, "$1$2[REDACTED]")
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

function scrubValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (depth > 4 || value == null) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1, seen));
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  try {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[REDACTED]"
          : /^(url|uri|href)$/i.test(key) && typeof item === "string"
            ? redactUrl(item)
            : scrubValue(item, depth + 1, seen),
      ]),
    );
  } catch {
    return "[Uninspectable Object]";
  }
}

function scrubEvent(event: SentryErrorEvent): SentryErrorEvent {
  delete event.user;

  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    event.request.url = redactUrl(event.request.url);
  }

  if (event.tags) {
    event.tags = scrubValue(event.tags) as Record<string, string>;
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }

  if (event.message) {
    event.message = redactString(event.message);
  }

  if (event.transaction) {
    event.transaction = redactString(event.transaction);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => {
      const stacktrace = exception.stacktrace
        ? {
            ...exception.stacktrace,
            frames: exception.stacktrace.frames?.map((frame) => ({
              ...frame,
              filename: frame.filename
                ? redactString(frame.filename)
                : frame.filename,
              abs_path: frame.abs_path
                ? redactString(frame.abs_path)
                : frame.abs_path,
            })),
          }
        : exception.stacktrace;

      return {
        ...exception,
        value: exception.value ? redactString(exception.value) : exception.value,
        stacktrace,
      };
    });
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

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return new Error(redactString(value));
  }

  const scrubbedValue = scrubValue(value);
  if (typeof scrubbedValue === "string" && scrubbedValue.trim()) {
    return new Error(scrubbedValue);
  }

  try {
    return new Error(JSON.stringify(scrubbedValue) || fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

function scheduleFlush(): void {
  void flushSentry().catch(() => false);
}

function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled) {
    return;
  }

  const runtimeGlobal = globalThis as RuntimeGlobal;
  if (!runtimeGlobal.addEventListener) {
    return;
  }

  try {
    runtimeGlobal.addEventListener("error", (event) => {
      const errorEvent = event as ErrorEvent;
      captureSentryException(
        errorEvent.error ??
          toError(errorEvent.message, "Uncaught extension runtime error"),
        {
          feature: "global_error",
          handled: false,
          mechanism: "global.onerror",
          extras: {
            filename: errorEvent.filename
              ? redactString(errorEvent.filename)
              : undefined,
            line: errorEvent.lineno,
            column: errorEvent.colno,
          },
        },
      );
      scheduleFlush();
    });

    runtimeGlobal.addEventListener("unhandledrejection", (event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      captureSentryException(
        toError(
          rejectionEvent.reason,
          "Unhandled extension promise rejection",
        ),
        {
          feature: "unhandled_rejection",
          handled: false,
          mechanism: "global.onunhandledrejection",
          extras: {
            reason: scrubValue(rejectionEvent.reason),
          },
        },
      );
      scheduleFlush();
    });
  } catch {
    // Observability must never prevent the extension runtime from starting.
    return;
  }

  globalHandlersInstalled = true;
}

function applyCaptureScope(
  scope: Sentry.Scope,
  options: CaptureOptions,
): void {
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
  if (options.context) {
    scope.setContext(
      "linku_capture",
      scrubValue(options.context) as Record<string, unknown>,
    );
  }
  if (options.handled !== undefined || options.mechanism) {
    scope.setContext("linku_error_handling", {
      handled: options.handled ?? true,
      mechanism: options.mechanism ?? "linku.capture",
    });
  }
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

  try {
    Sentry.init({
      dsn,
      environment:
        import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
        (import.meta.env.DEV ? "development" : "production"),
      release: getReleaseName(version),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      attachStacktrace: true,
      maxBreadcrumbs: 200,
      maxValueLength: 1_000,
      normalizeDepth: 6,
      normalizeMaxBreadth: 100,
      integrations(defaultIntegrations) {
        // The SDK's global handler integration is disabled so every runtime
        // uses the same explicit handlers below, including MV3 service workers.
        return defaultIntegrations.filter(
          (integration) => integration.name !== "GlobalHandlers",
        );
      },
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
  } catch {
    activeRuntime = undefined;
    return;
  }

  Sentry.setTags({
    linku_runtime: runtime,
    linku_collection_mode: "full_errors",
    ...(version ? { linku_extension_version: version } : {}),
  });
  Sentry.setContext("linku_extension", {
    runtime,
    extension_version: version,
    manifest_version: version,
    is_chrome_extension: true,
  });
  sentryReady = true;
  installGlobalErrorHandlers();
  addSentryBreadcrumb("extension.lifecycle", "Sentry initialized", {
    runtime,
    extension_version: version,
  });

  if (import.meta.env.VITE_SENTRY_SMOKE_TEST === "true") {
    Sentry.captureMessage(`LinKU Sentry smoke test: ${runtime}`, "warning");
    scheduleFlush();
  }
}

export function captureSentryException(
  error: unknown,
  options: CaptureOptions = {},
): void {
  if (!sentryReady) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      applyCaptureScope(scope, options);
      Sentry.captureException(error, {
        mechanism: {
          handled: options.handled ?? true,
          type: options.mechanism ?? "linku.capture",
        },
      });
    });
  } catch {
    // Capturing an error must never throw a second error into the product.
  }
}

export function captureSentryMessage(
  message: string,
  level: SentryLevel = "error",
  options: CaptureOptions = {},
): void {
  if (!sentryReady) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      applyCaptureScope(scope, options);
      scope.setLevel(level);
      Sentry.captureMessage(redactString(message));
    });
  } catch {
    // Capturing an error must never throw a second error into the product.
  }
}

export function addSentryBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: SentryLevel = "info",
): void {
  if (!sentryReady) {
    return;
  }

  try {
    const breadcrumb: Breadcrumb = {
      category,
      message: redactString(message),
      level,
      ...(data ? { data: scrubValue(data) as Record<string, unknown> } : {}),
    };
    Sentry.addBreadcrumb(breadcrumb);
  } catch {
    // Breadcrumbs are best-effort context and must not affect product code.
  }
}

export function flushSentry(timeout = 2_000): Promise<boolean> {
  if (!sentryReady) {
    return Promise.resolve(true);
  }

  try {
    return Sentry.flush(timeout);
  } catch {
    return Promise.resolve(false);
  }
}
