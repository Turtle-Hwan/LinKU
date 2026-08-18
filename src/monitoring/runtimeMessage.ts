import type { MonitoringReporter } from "./reporter";
import type { MonitoringRuntime } from "./types";

type MessageRuntime = Exclude<MonitoringRuntime, "popup">;

type RuntimeMessageMonitoring = Pick<
  MonitoringReporter,
  "recordBreadcrumb" | "reportError" | "reportMessage"
>;

export type RuntimeMessageResponderOptions<Response> = {
  runtime: MessageRuntime;
  messageType: string;
  sendResponse: (response: Response) => void;
};

function getResponseSummary(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object") {
    return { response_type: typeof response };
  }

  const typedResponse = response as { success?: unknown; error?: unknown };
  return {
    success: typedResponse.success === true,
    has_error: typeof typedResponse.error === "string",
  };
}

export function getRuntimeMessageType(message: unknown): string {
  if (
    message &&
    typeof message === "object" &&
    "type" in message &&
    typeof message.type === "string"
  ) {
    return message.type;
  }

  return "invalid";
}

export function createRuntimeMessageResponder<Response>(
  monitoring: RuntimeMessageMonitoring,
  options: RuntimeMessageResponderOptions<Response>,
): (response: Response) => void {
  let hasResponded = false;
  const category = `${options.runtime}.message`;

  return (response: Response) => {
    if (hasResponded) {
      monitoring.reportMessage(
        `${options.runtime} response attempted more than once`,
        {
          feature: "runtime_message_response_duplicate",
          category,
          breadcrumbMessage: "response attempted more than once",
          level: "warning",
          mechanism: "runtime.sendResponse",
          tags: { message_type: options.messageType },
        },
      );
      return;
    }

    hasResponded = true;
    try {
      options.sendResponse(response);
      monitoring.recordBreadcrumb(category, "response sent", {
        message_type: options.messageType,
        ...getResponseSummary(response),
      });
    } catch (error) {
      monitoring.reportError(error, {
        feature: "runtime_message_response",
        category,
        breadcrumbMessage: "response delivery failed",
        mechanism: "runtime.sendResponse",
        extras: {
          message_type: options.messageType,
          response_sent: false,
        },
      });
    }
  };
}
