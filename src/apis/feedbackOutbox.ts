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

type OutboxWarningReporter = (message: string, error: unknown) => void;

// This module is imported directly by node tests, so it must not pull in the
// alias-resolved logger. The app installs a real reporter at startup; tests
// keep the no-op and stay dependency-free.
let reportOutboxWarning: OutboxWarningReporter = () => {};

export function setFeedbackOutboxWarningReporter(
  reporter: OutboxWarningReporter,
): void {
  reportOutboxWarning = reporter;
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
  } catch (error) {
    // Unparseable storage means feedback the user already wrote is dropped.
    // Returning an empty outbox keeps the app working, but the loss must not
    // be invisible.
    reportOutboxWarning("[Feedback] Discarded an unreadable outbox", error);
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
