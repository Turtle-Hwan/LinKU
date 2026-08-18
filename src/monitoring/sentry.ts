import * as Sentry from "@sentry/browser";
import type {
  Breadcrumb,
  ErrorEvent as SentryErrorEvent,
} from "@sentry/browser";
import {
  isSensitiveKey,
  redactSensitiveString as redactString,
  redactSensitiveUrl as redactUrl,
} from "./redaction";
import type {
  CaptureContext,
  MonitoringCollector,
  MonitoringInitResult,
  MonitoringLevel,
  MonitoringRuntime,
} from "./types";

let activeRuntime: MonitoringRuntime | undefined;
let activeExtensionVersion: string | undefined;
let sentryReady = false;

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
        isSensitiveKey(key)
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

function applyCaptureScope(
  scope: Sentry.Scope,
  options: CaptureContext,
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
  if (options.level) {
    scope.setLevel(options.level);
  }
  if (options.handled !== undefined || options.mechanism) {
    scope.setContext("linku_error_handling", {
      handled: options.handled ?? true,
      mechanism: options.mechanism ?? "linku.capture",
    });
  }
}

function initSentry(runtime: MonitoringRuntime): MonitoringInitResult {
  if (sentryReady) {
    return {
      initialized: true,
      extensionVersion: activeExtensionVersion,
    };
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return { initialized: false };
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
        // The SDK's global handler integration is disabled so the common
        // reporter can install the same handlers in every MV3 runtime.
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
    return { initialized: false };
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
  activeExtensionVersion = version;
  sentryReady = true;
  return { initialized: true, extensionVersion: version };
}

function captureSentryException(
  error: Error,
  options: CaptureContext = {},
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

function captureSentryMessage(
  message: string,
  level: MonitoringLevel = "error",
  options: CaptureContext = {},
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

function addSentryBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: MonitoringLevel = "info",
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

function flushSentry(timeout = 2_000): Promise<boolean> {
  if (!sentryReady) {
    return Promise.resolve(true);
  }

  try {
    return Sentry.flush(timeout);
  } catch {
    return Promise.resolve(false);
  }
}

export const sentryCollector: MonitoringCollector = {
  init: initSentry,
  captureException: captureSentryException,
  captureMessage: captureSentryMessage,
  addBreadcrumb: addSentryBreadcrumb,
  flush: flushSentry,
};
