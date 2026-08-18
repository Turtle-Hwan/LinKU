import { createMonitoringReporter } from "./reporter";
import {
  createRuntimeMessageResponder as createResponder,
  getRuntimeMessageType,
} from "./runtimeMessage";
import { sentryCollector } from "./sentry";

const monitoring = createMonitoringReporter(sentryCollector, {
  runtimeGlobal: globalThis,
  smokeTest: import.meta.env.VITE_SENTRY_SMOKE_TEST === "true",
});

export const initMonitoring = monitoring.init;
export const reportError = monitoring.reportError;
export const reportMessage = monitoring.reportMessage;
export const recordBreadcrumb = monitoring.recordBreadcrumb;
export const flushMonitoring = monitoring.flush;
export const createErrorReporter = monitoring.createErrorReporter;
export { getRuntimeMessageType };

export function createRuntimeMessageResponder<Response>(
  options: import("./runtimeMessage").RuntimeMessageResponderOptions<Response>,
): (response: Response) => void {
  return createResponder(monitoring, options);
}

export type {
  ErrorReporter,
  MonitoringReporter,
  ReportOptions,
} from "./reporter";
export type { MonitoringLevel, MonitoringRuntime } from "./types";
export type { RuntimeMessageResponderOptions } from "./runtimeMessage";
