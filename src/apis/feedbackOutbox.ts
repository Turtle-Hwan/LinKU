import {
  feedbackSubmissionSchema,
  type FeedbackSubmission,
} from "../types/feedback.ts";

const FEEDBACK_OUTBOX_STORAGE_KEY = "linkuFeedbackOutboxV1";

function parseFeedbackOutbox(value: unknown): FeedbackSubmission[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const result = feedbackSubmissionSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

function getExtensionStorage(): chrome.storage.StorageArea | null {
  return globalThis.chrome?.storage?.local ?? null;
}

function getWebStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function readFeedbackOutbox(): Promise<FeedbackSubmission[]> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    const stored = await extensionStorage.get(FEEDBACK_OUTBOX_STORAGE_KEY);
    return parseFeedbackOutbox(stored[FEEDBACK_OUTBOX_STORAGE_KEY]);
  }

  const webStorage = getWebStorage();
  if (!webStorage) return [];

  const stored = webStorage.getItem(FEEDBACK_OUTBOX_STORAGE_KEY);
  if (!stored) return [];

  try {
    return parseFeedbackOutbox(JSON.parse(stored));
  } catch {
    return [];
  }
}

export async function writeFeedbackOutbox(
  outbox: FeedbackSubmission[],
): Promise<void> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    await extensionStorage.set({ [FEEDBACK_OUTBOX_STORAGE_KEY]: outbox });
    return;
  }

  const webStorage = getWebStorage();
  if (!webStorage) {
    throw new Error("FEEDBACK_OUTBOX_STORAGE_UNAVAILABLE");
  }

  webStorage.setItem(FEEDBACK_OUTBOX_STORAGE_KEY, JSON.stringify(outbox));
}
