import type {
  CaptureContext,
  MonitoringCollector,
  MonitoringInitResult,
  MonitoringLevel,
  MonitoringRuntime,
} from "./types";

const DEFAULT_FLUSH_TIMEOUT_MS = 2_000;

type RuntimeGlobal = {
  addEventListener?: (
    type: string,
    listener: (event: Event) => void,
  ) => void;
};

export type ReportOptions = Omit<CaptureContext, "feature" | "level"> & {
  feature: string;
  category?: string;
  breadcrumbMessage?: string;
  level?: MonitoringLevel;
  flush?: boolean;
};

export type ErrorReporter = (
  error: unknown,
  options: ReportOptions,
) => void;

export type MonitoringReporterOptions = {
  runtimeGlobal?: RuntimeGlobal;
  smokeTest?: boolean;
};

export type MonitoringReporter = {
  init(runtime: MonitoringRuntime): boolean;
  reportError(error: unknown, options: ReportOptions): void;
  reportMessage(message: string, options: ReportOptions): void;
  recordBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level?: MonitoringLevel,
  ): void;
  flush(timeout?: number): Promise<boolean>;
  createErrorReporter(defaults: Partial<ReportOptions>): ErrorReporter;
};

function mergeRecords<T>(
  defaults?: Record<string, T>,
  overrides?: Record<string, T>,
): Record<string, T> | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }

  return { ...defaults, ...overrides };
}

function mergeReportOptions(
  defaults: Partial<ReportOptions>,
  options: ReportOptions,
): ReportOptions {
  return {
    ...defaults,
    ...options,
    tags: mergeRecords(defaults.tags, options.tags),
    extras: mergeRecords(defaults.extras, options.extras),
    context: mergeRecords(defaults.context, options.context),
  };
}

function normalizeError(
  value: unknown,
  fallbackMessage: string,
): { error: Error; originalValue?: unknown } {
  if (value instanceof Error) {
    return { error: value };
  }

  if (typeof value === "string" && value.trim()) {
    return { error: new Error(value) };
  }

  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.trim()
  ) {
    return {
      error: new Error(value.message),
      originalValue: value,
    };
  }

  return {
    error: new Error(fallbackMessage),
    originalValue: value,
  };
}

export function createMonitoringReporter(
  collector: MonitoringCollector,
  options: MonitoringReporterOptions = {},
): MonitoringReporter {
  let globalHandlersInstalled = false;

  const flush = (timeout = DEFAULT_FLUSH_TIMEOUT_MS): Promise<boolean> => {
    try {
      return collector.flush(timeout);
    } catch {
      return Promise.resolve(false);
    }
  };

  const scheduleFlush = (): void => {
    void flush().catch(() => false);
  };

  const recordBreadcrumb = (
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level: MonitoringLevel = "info",
  ): void => {
    try {
      collector.addBreadcrumb(category, message, data, level);
    } catch {
      // Monitoring context must never interrupt the product flow.
    }
  };

  const reportError = (
    errorValue: unknown,
    reportOptions: ReportOptions,
  ): void => {
    const level = reportOptions.level ?? "error";
    const category = reportOptions.category ?? "extension.error";
    const breadcrumbMessage =
      reportOptions.breadcrumbMessage ?? `${reportOptions.feature} failed`;
    const normalized = normalizeError(errorValue, breadcrumbMessage);
    const extras = normalized.originalValue === undefined
      ? reportOptions.extras
      : {
          ...reportOptions.extras,
          original_error: normalized.originalValue,
        };

    recordBreadcrumb(
      category,
      breadcrumbMessage,
      reportOptions.extras,
      level,
    );
    try {
      collector.captureException(normalized.error, {
        feature: reportOptions.feature,
        tags: reportOptions.tags,
        extras,
        context: reportOptions.context,
        handled: reportOptions.handled,
        mechanism: reportOptions.mechanism,
        level,
      });
    } catch {
      // Reporting one error must never create another product error.
    }

    if (reportOptions.flush !== false) {
      scheduleFlush();
    }
  };

  const reportMessage = (
    message: string,
    reportOptions: ReportOptions,
  ): void => {
    const level = reportOptions.level ?? "error";
    const category = reportOptions.category ?? "extension.error";

    recordBreadcrumb(
      category,
      reportOptions.breadcrumbMessage ?? message,
      reportOptions.extras,
      level,
    );
    try {
      collector.captureMessage(message, level, {
        feature: reportOptions.feature,
        tags: reportOptions.tags,
        extras: reportOptions.extras,
        context: reportOptions.context,
        handled: reportOptions.handled,
        mechanism: reportOptions.mechanism,
        level,
      });
    } catch {
      // Reporting one error must never create another product error.
    }

    if (reportOptions.flush !== false) {
      scheduleFlush();
    }
  };

  const createErrorReporter = (
    defaults: Partial<ReportOptions>,
  ): ErrorReporter => (
    error: unknown,
    reportOptions: ReportOptions,
  ) => {
    reportError(error, mergeReportOptions(defaults, reportOptions));
  };

  const installGlobalErrorHandlers = (): void => {
    if (globalHandlersInstalled || !options.runtimeGlobal?.addEventListener) {
      return;
    }

    try {
      options.runtimeGlobal.addEventListener("error", (event) => {
        const errorEvent = event as ErrorEvent;
        reportError(
          errorEvent.error ?? errorEvent.message,
          {
            feature: "global_error",
            category: "extension.error",
            breadcrumbMessage: "uncaught runtime error",
            handled: false,
            mechanism: "global.onerror",
            extras: {
              filename: errorEvent.filename,
              line: errorEvent.lineno,
              column: errorEvent.colno,
            },
          },
        );
      });

      options.runtimeGlobal.addEventListener("unhandledrejection", (event) => {
        const rejectionEvent = event as PromiseRejectionEvent;
        reportError(rejectionEvent.reason, {
          feature: "unhandled_rejection",
          category: "extension.error",
          breadcrumbMessage: "unhandled promise rejection",
          handled: false,
          mechanism: "global.onunhandledrejection",
        });
      });
    } catch {
      return;
    }

    globalHandlersInstalled = true;
  };

  const init = (runtime: MonitoringRuntime): boolean => {
    let result: MonitoringInitResult;
    try {
      result = collector.init(runtime);
    } catch {
      return false;
    }
    if (!result.initialized) {
      return false;
    }

    installGlobalErrorHandlers();
    recordBreadcrumb("extension.lifecycle", "monitoring initialized", {
      runtime,
      extension_version: result.extensionVersion,
    });

    if (options.smokeTest) {
      reportMessage(`LinKU Sentry smoke test: ${runtime}`, {
        feature: "sentry_smoke_test",
        category: "extension.lifecycle",
        level: "warning",
        mechanism: "monitoring.smoke_test",
      });
    }

    return true;
  };

  return {
    init,
    reportError,
    reportMessage,
    recordBreadcrumb,
    flush,
    createErrorReporter,
  };
}
