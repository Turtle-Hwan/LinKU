import type {
  CaptureContext,
  MonitoringCollector,
  MonitoringLevel,
  MonitoringRuntime,
} from "../../src/monitoring/types.ts";

export type CollectorCalls = {
  init: MonitoringRuntime[];
  exceptions: Array<{ error: Error; context?: CaptureContext }>;
  messages: Array<{
    message: string;
    level?: MonitoringLevel;
    context?: CaptureContext;
  }>;
  breadcrumbs: Array<{
    category: string;
    message: string;
    data?: Record<string, unknown>;
    level?: MonitoringLevel;
  }>;
  flushes: number[];
};

export function createCollector(): {
  collector: MonitoringCollector;
  calls: CollectorCalls;
} {
  const calls: CollectorCalls = {
    init: [],
    exceptions: [],
    messages: [],
    breadcrumbs: [],
    flushes: [],
  };

  return {
    calls,
    collector: {
      init(runtime) {
        calls.init.push(runtime);
        return { initialized: true, extensionVersion: "1.2.3" };
      },
      captureException(error, context) {
        calls.exceptions.push({ error, context });
      },
      captureMessage(message, level, context) {
        calls.messages.push({ message, level, context });
      },
      addBreadcrumb(category, message, data, level) {
        calls.breadcrumbs.push({ category, message, data, level });
      },
      flush(timeout = 2_000) {
        calls.flushes.push(timeout);
        return Promise.resolve(true);
      },
    },
  };
}
