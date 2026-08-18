export type MonitoringRuntime = "popup" | "background" | "content";

export type MonitoringLevel =
  | "fatal"
  | "error"
  | "warning"
  | "log"
  | "info"
  | "debug";

export type CaptureContext = {
  feature?: string;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
  context?: Record<string, unknown>;
  handled?: boolean;
  mechanism?: string;
  level?: MonitoringLevel;
};

export type MonitoringInitResult = {
  initialized: boolean;
  extensionVersion?: string;
};

export interface MonitoringCollector {
  init(runtime: MonitoringRuntime): MonitoringInitResult;
  captureException(error: Error, context?: CaptureContext): void;
  captureMessage(
    message: string,
    level?: MonitoringLevel,
    context?: CaptureContext,
  ): void;
  addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level?: MonitoringLevel,
  ): void;
  flush(timeout?: number): Promise<boolean>;
}
