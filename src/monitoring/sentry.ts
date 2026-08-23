import * as Sentry from "@sentry/browser";
import type { Breadcrumb } from "@sentry/browser";
import {
  MONITORING_FLUSH_TIMEOUT_MS,
  MONITORING_IGNORED_ERROR_MESSAGES,
  MONITORING_MAX_BREADCRUMBS,
  MONITORING_MAX_VALUE_LENGTH,
  MONITORING_NORMALIZE_DEPTH,
  MONITORING_NORMALIZE_MAX_BREADTH,
} from "./constants";
import { resolveSentryEnvironment } from "./environment";
import { redactSensitiveString } from "./redaction";
import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubValue,
} from "./scrubber";
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
      environment: resolveSentryEnvironment(
        import.meta.env.VITE_SENTRY_ENVIRONMENT,
        import.meta.env.MODE,
      ),
      release: getReleaseName(version),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      attachStacktrace: true,
      maxBreadcrumbs: MONITORING_MAX_BREADCRUMBS,
      maxValueLength: MONITORING_MAX_VALUE_LENGTH,
      normalizeDepth: MONITORING_NORMALIZE_DEPTH,
      normalizeMaxBreadth: MONITORING_NORMALIZE_MAX_BREADTH,
      ignoreErrors: [...MONITORING_IGNORED_ERROR_MESSAGES],
      integrations(defaultIntegrations) {
        // The SDK's global handler integration is disabled so the common
        // reporter can install the same handlers in every MV3 runtime.
        return defaultIntegrations.filter(
          (integration) => integration.name !== "GlobalHandlers",
        );
      },
      beforeSend: scrubSentryEvent,
      beforeBreadcrumb: scrubSentryBreadcrumb,
    });
  } catch {
    activeRuntime = undefined;
    return { initialized: false };
  }

  activeExtensionVersion = version;
  sentryReady = true;
  try {
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
  } catch {
    // Static context is best-effort; the collector remains usable without it.
  }
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
      Sentry.captureMessage(redactSensitiveString(message));
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
    const breadcrumb = scrubSentryBreadcrumb({
      category,
      message,
      level,
      ...(data ? { data } : {}),
    } satisfies Breadcrumb);
    Sentry.addBreadcrumb(breadcrumb);
  } catch {
    // Breadcrumbs are best-effort context and must not affect product code.
  }
}

function flushSentry(
  timeout = MONITORING_FLUSH_TIMEOUT_MS,
): Promise<boolean> {
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
