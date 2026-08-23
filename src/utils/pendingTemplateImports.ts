import type { TemplateSharePayloadV1 } from "@/types/templateShare";
import {
  getTemplateSharePayloadKey,
  InvalidSharedIconError,
  validateTemplateSharePayload,
  validateTemplateSharePayloadImages,
} from "@/utils/templateShareCodec";
import { errorLog } from "@/utils/logger";
import { UserFacingError } from "@/errors/userFacingError";
import {
  consumeCheckpointedQueue,
  planUniqueQueueAppend,
  writeCheckpointedQueue,
} from "@/utils/checkpointedQueue";

const STORAGE_KEY = "pendingTemplateImports";
const MAX_PENDING_IMPORTS = 5;
const MUTATION_LOCK = "linku:pending-template-imports";

export interface PendingTemplateImportResult {
  importedCount: number;
  failedCount: number;
}

let mutationQueue: Promise<void> = Promise.resolve();

function withMutationQueue<T>(operation: () => Promise<T>): Promise<T> {
  // The popup and background worker run separate module instances, so an
  // in-memory promise only serializes callers inside one runtime. Web Locks
  // protects the shared chrome.storage value across both extension contexts.
  if (globalThis.navigator?.locks) {
    return globalThis.navigator.locks.request(MUTATION_LOCK, operation);
  }

  // Keep a fallback for test or older non-browser runtimes.
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function getStorage(): chrome.storage.StorageArea {
  if (!globalThis.chrome?.storage?.local) {
    throw new Error("확장 프로그램 저장소를 사용할 수 없습니다.");
  }
  return chrome.storage.local;
}

function readValidQueue(value: unknown): TemplateSharePayloadV1[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is TemplateSharePayloadV1 => {
    try {
      validateTemplateSharePayload(candidate);
      return true;
    } catch (error) {
      errorLog("Discarding invalid pending template import", error);
      return false;
    }
  });
}

function toInvalidImportError(error: unknown): UserFacingError {
  return new UserFacingError(
    error instanceof Error ? error.message : "공유 데이터가 올바르지 않습니다.",
  );
}

export async function enqueuePendingTemplateImport(
  value: unknown,
): Promise<"queued" | "already-queued"> {
  try {
    validateTemplateSharePayload(value);
  } catch (error) {
    throw toInvalidImportError(error);
  }

  try {
    await validateTemplateSharePayloadImages(value);
  } catch (error) {
    if (error instanceof InvalidSharedIconError) {
      throw toInvalidImportError(error);
    }
    throw error;
  }

  return withMutationQueue(async () => {
    const storage = getStorage();
    const stored = await storage.get(STORAGE_KEY);
    const queue = readValidQueue(stored[STORAGE_KEY]);
    const append = planUniqueQueueAppend(
      queue,
      value,
      MAX_PENDING_IMPORTS,
      getTemplateSharePayloadKey,
    );
    if (append.status === "duplicate") return "already-queued";
    if (append.status === "full") {
      throw new UserFacingError(
        "대기 중인 템플릿이 5개입니다. LinKU를 열어 가져오기를 마친 뒤 다시 시도해 주세요.",
      );
    }
    await storage.set({ [STORAGE_KEY]: append.queue });
    return "queued";
  });
}

export function consumePendingTemplateImports(
  importer: (payload: TemplateSharePayloadV1) => Promise<void>,
): Promise<PendingTemplateImportResult> {
  return withMutationQueue(async () => {
    const storage = getStorage();
    const stored = await storage.get(STORAGE_KEY);
    const queue = readValidQueue(stored[STORAGE_KEY]);
    if (queue.length === 0) {
      await storage.remove(STORAGE_KEY);
      return { importedCount: 0, failedCount: 0 };
    }

    const result = await consumeCheckpointedQueue(
      queue,
      importer,
      (remaining) =>
        writeCheckpointedQueue(storage, STORAGE_KEY, remaining),
      (error) => {
        errorLog("Failed to consume pending template import", error);
      },
    );
    return {
      importedCount: result.completedCount,
      failedCount: result.failedCount,
    };
  });
}
