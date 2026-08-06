import type {
  FeedbackCategory,
  FeedbackDeliveryResult,
  FeedbackEndpointResponse,
  FeedbackSubmission,
} from "@/types/feedback";
import { getStorage, setStorage } from "@/utils/chrome";
import { errorLog } from "@/utils/logger";

const FEEDBACK_OUTBOX_STORAGE_KEY = "linkuFeedbackOutboxV1";
const MAX_OUTBOX_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12_000;

interface FeedbackInput {
  category: FeedbackCategory;
  title: string;
  message: string;
}

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

function isFeedbackSubmission(value: unknown): value is FeedbackSubmission {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<FeedbackSubmission>;
  return (
    typeof candidate.submissionId === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.extensionVersion === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.website === "string"
  );
}

async function readOutbox() {
  const stored = await getStorage<unknown>(FEEDBACK_OUTBOX_STORAGE_KEY);
  if (!Array.isArray(stored)) return [];

  return stored.filter(isFeedbackSubmission);
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
    const outbox = await readOutbox();
    if (outbox.some((item) => item.submissionId === submission.submissionId)) {
      return;
    }

    if (outbox.length >= MAX_OUTBOX_SIZE) {
      throw new Error("FEEDBACK_OUTBOX_FULL");
    }

    await setStorage({
      [FEEDBACK_OUTBOX_STORAGE_KEY]: [...outbox, submission],
    });
  });
}

async function removeFromOutbox(submissionId: string) {
  await withOutboxLock(async () => {
    const outbox = await readOutbox();
    const nextOutbox = outbox.filter(
      (item) => item.submissionId !== submissionId,
    );

    if (nextOutbox.length !== outbox.length) {
      await setStorage({ [FEEDBACK_OUTBOX_STORAGE_KEY]: nextOutbox });
    }
  });
}

async function postFeedback(submission: FeedbackSubmission) {
  const activeDelivery = activeDeliveries.get(submission.submissionId);
  if (activeDelivery) return activeDelivery;

  const delivery = (async () => {
    const endpoint = getFeedbackEndpoint();
    if (!endpoint) throw new Error("FEEDBACK_ENDPOINT_NOT_CONFIGURED");

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

      const responseBody = (await response.json()) as FeedbackEndpointResponse;
      if (!response.ok || !responseBody.success || !responseBody.persisted) {
        throw new Error(responseBody.error || "FEEDBACK_NOT_PERSISTED");
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
    errorLog("[VoC] Failed to remove persisted feedback from outbox:", error);
  }

  return response;
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<FeedbackDeliveryResult> {
  const submission: FeedbackSubmission = {
    submissionId: crypto.randomUUID(),
    category: input.category,
    title: input.title.trim(),
    message: input.message.trim(),
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
    errorLog("[VoC] Feedback queued for retry:", error);
    return { status: "queued" };
  }
}

export function flushFeedbackOutbox() {
  if (activeFlush) return activeFlush;

  activeFlush = (async () => {
    try {
      const outbox = await readOutbox();

      // 한 건의 실패가 뒤의 제출을 막지 않도록 각 항목을 독립적으로 처리합니다.
      for (const submission of outbox) {
        try {
          await deliverFeedback(submission);
        } catch (error) {
          errorLog("[VoC] Outbox retry failed:", error);
        }
      }
    } catch (error) {
      errorLog("[VoC] Failed to read feedback outbox:", error);
    }
  })().finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}
