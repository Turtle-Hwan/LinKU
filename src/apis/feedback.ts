import {
  feedbackEndpointResponseSchema,
  feedbackInputSchema,
  type FeedbackDeliveryResult,
  type FeedbackEndpointResponse,
  type FeedbackInput,
  type FeedbackSubmission,
} from "@/types/feedback";
import { recordBreadcrumb } from "@/monitoring";
import { captureErrorLog, warnLog } from "@/utils/logger";
import {
  classifyNetworkFailure,
  type NetworkFailureKind,
} from "@/utils/networkFailure";
import {
  readFeedbackOutbox,
  setFeedbackOutboxWarningReporter,
  writeFeedbackOutbox,
} from "@/apis/feedbackOutbox";

setFeedbackOutboxWarningReporter((message, error) => {
  // An unreadable outbox is persistent data loss, not a transient warning.
  // Keep the original parsing error as this boundary's single capture owner.
  captureErrorLog(message, error);
});

const MAX_OUTBOX_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12_000;

type FeedbackFailureKind =
  | Exclude<NetworkFailureKind, "unknown">
  | "configuration"
  | "endpoint"
  | "contract"
  | "persistence"
  | "unexpected";

interface FeedbackFailureDescription {
  kind: FeedbackFailureKind;
  endpointWide: boolean;
  expected: boolean;
  originalError: Error;
  deliveryCode?: string;
}

class FeedbackDeliveryError extends Error {
  readonly kind: Exclude<
    FeedbackFailureKind,
    NetworkFailureKind | "unexpected"
  >;

  readonly endpointWide: boolean;
  readonly originalError: Error;

  constructor(
    code: string,
    kind: FeedbackDeliveryError["kind"],
    endpointWide: boolean,
    originalError?: unknown,
  ) {
    super(code);
    this.name = "FeedbackDeliveryError";
    this.kind = kind;
    this.endpointWide = endpointWide;
    this.originalError = originalError instanceof Error
      ? originalError
      : this;
  }
}

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

const describeFeedbackFailure = (
  error: unknown,
): FeedbackFailureDescription => {
  const networkKind = classifyNetworkFailure(error);
  if (networkKind !== "unknown") {
    return {
      kind: networkKind,
      endpointWide: true,
      expected: true,
      originalError: toError(error),
    };
  }

  if (error instanceof FeedbackDeliveryError) {
    return {
      kind: error.kind,
      endpointWide: error.endpointWide,
      expected: false,
      originalError: error.originalError,
      deliveryCode: error.message,
    };
  }

  return {
    kind: "unexpected",
    endpointWide: false,
    expected: false,
    originalError: toError(error),
  };
};

const reportFeedbackFailure = (
  message: string,
  error: unknown,
  captureUnexpected: boolean = true,
) => {
  const failure = describeFeedbackFailure(error);
  recordBreadcrumb("feedback.delivery", "feedback delivery deferred", {
    failure_kind: failure.kind,
    endpoint_wide: failure.endpointWide,
    delivery_code: failure.deliveryCode,
  }, failure.expected ? "warning" : "error");

  if (failure.expected || !captureUnexpected) {
    warnLog(message, failure.originalError);
  } else {
    // Pass the originating Error object, not sanitized log details, so Sentry
    // retains its real type and stack.
    captureErrorLog(message, failure.originalError, {
      failure_kind: failure.kind,
      endpoint_wide: failure.endpointWide,
      delivery_code: failure.deliveryCode,
    });
  }

  return failure;
};

const activeDeliveries = new Map<
  string,
  Promise<FeedbackEndpointResponse>
>();

let outboxOperation = Promise.resolve();
let activeFlush: Promise<void> | null = null;

function getFeedbackEndpoint() {
  const endpoint = import.meta.env.VITE_VOC_ENDPOINT?.trim() ?? "";

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function getExtensionVersion() {
  try {
    return chrome.runtime?.getManifest().version ?? "development";
  } catch {
    return "development";
  }
}

function withOutboxLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = outboxOperation.then(operation, operation);
  outboxOperation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function enqueueFeedback(submission: FeedbackSubmission) {
  await withOutboxLock(async () => {
    const outbox = await readFeedbackOutbox();
    if (outbox.some((item) => item.submissionId === submission.submissionId)) {
      return;
    }

    if (outbox.length >= MAX_OUTBOX_SIZE) {
      throw new Error("FEEDBACK_OUTBOX_FULL");
    }

    await writeFeedbackOutbox([...outbox, submission]);
  });
}

async function removeFromOutbox(submissionId: string) {
  await withOutboxLock(async () => {
    const outbox = await readFeedbackOutbox();
    const nextOutbox = outbox.filter(
      (item) => item.submissionId !== submissionId,
    );

    if (nextOutbox.length !== outbox.length) {
      await writeFeedbackOutbox(nextOutbox);
    }
  });
}

async function postFeedback(submission: FeedbackSubmission) {
  const activeDelivery = activeDeliveries.get(submission.submissionId);
  if (activeDelivery) return activeDelivery;

  const delivery = (async () => {
    const endpoint = getFeedbackEndpoint();
    if (!endpoint) {
      throw new FeedbackDeliveryError(
        "FEEDBACK_ENDPOINT_NOT_CONFIGURED",
        "configuration",
        true,
      );
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(submission),
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        const httpError = new Error(`Feedback endpoint returned ${response.status}`);
        Object.assign(httpError, {
          status: response.status,
          statusText: response.statusText,
        });
        throw new FeedbackDeliveryError(
          `FEEDBACK_HTTP_${response.status}`,
          "endpoint",
          true,
          httpError,
        );
      }

      let responseValue: unknown;
      try {
        responseValue = await response.json();
      } catch (error) {
        throw new FeedbackDeliveryError(
          "FEEDBACK_RESPONSE_INVALID_JSON",
          "contract",
          true,
          error,
        );
      }

      const parsedResponse = feedbackEndpointResponseSchema.safeParse(
        responseValue,
      );
      if (!parsedResponse.success) {
        throw new FeedbackDeliveryError(
          "FEEDBACK_RESPONSE_SCHEMA_MISMATCH",
          "contract",
          true,
          parsedResponse.error,
        );
      }

      const responseBody = parsedResponse.data;
      if (!responseBody.success || !responseBody.persisted) {
        throw new FeedbackDeliveryError(
          responseBody.error || "FEEDBACK_NOT_PERSISTED",
          "persistence",
          false,
        );
      }
      if (
        submission.contactEmail &&
        responseBody.contactEmailStored !== true
      ) {
        throw new FeedbackDeliveryError(
          "FEEDBACK_CONTACT_EMAIL_NOT_PERSISTED",
          "persistence",
          false,
        );
      }

      return responseBody;
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  activeDeliveries.set(submission.submissionId, delivery);
  try {
    return await delivery;
  } finally {
    activeDeliveries.delete(submission.submissionId);
  }
}

async function deliverFeedback(submission: FeedbackSubmission) {
  const response = await postFeedback(submission);

  try {
    await removeFromOutbox(submission.submissionId);
  } catch (error) {
    // Sheet 저장은 완료됐으므로 로컬 삭제 실패는 다음 중복 전송에서 정리합니다.
    captureErrorLog("[VoC] Failed to remove persisted feedback from outbox:", error);
  }

  return response;
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<FeedbackDeliveryResult> {
  const { contactEmail, title, message } = feedbackInputSchema.parse(input);

  const submission: FeedbackSubmission = {
    submissionId: crypto.randomUUID(),
    // 기존 Sheet 스키마와 아직 전송되지 않은 의견을 보존하기 위한 내부 기본값입니다.
    category: "other",
    title,
    message,
    contactEmail,
    extensionVersion: getExtensionVersion(),
    createdAt: new Date().toISOString(),
    website: "",
  };

  // 네트워크 요청보다 먼저 보관해 실패 시에도 다시 보낼 수 있게 합니다.
  await enqueueFeedback(submission);

  try {
    await deliverFeedback(submission);
    return {
      status: "persisted",
    };
  } catch (error) {
    reportFeedbackFailure("[VoC] Feedback queued for retry:", error);
    return { status: "queued" };
  }
}

export function flushFeedbackOutbox() {
  if (activeFlush) return activeFlush;

  activeFlush = (async () => {
    try {
      const outbox = await readFeedbackOutbox();
      let capturedUnexpectedFailure = false;

      for (const submission of outbox) {
        try {
          await deliverFeedback(submission);
        } catch (error) {
          const failure = reportFeedbackFailure(
            "[VoC] Outbox retry failed:",
            error,
            !capturedUnexpectedFailure,
          );
          capturedUnexpectedFailure ||= !failure.expected;

          // Retrying every queued item against the same unavailable or
          // misconfigured endpoint only repeats work and duplicate events.
          if (failure.endpointWide) {
            break;
          }
        }
      }
    } catch (error) {
      captureErrorLog("[VoC] Failed to read feedback outbox:", error);
    }
  })().finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}
