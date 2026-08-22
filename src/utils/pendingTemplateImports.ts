import type { TemplateSharePayloadV1 } from "@/types/templateShare";
import { validateTemplateSharePayload } from "@/utils/templateShareCodec";
import { errorLog } from "@/utils/logger";
import { UserFacingError } from "@/errors/userFacingError";

const STORAGE_KEY = "pendingTemplateImports";
const MAX_PENDING_IMPORTS = 5;

export interface PendingTemplateImportResult {
  importedCount: number;
  failedCount: number;
}

let mutationQueue: Promise<void> = Promise.resolve();

function withMutationQueue<T>(operation: () => Promise<T>): Promise<T> {
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

export function enqueuePendingTemplateImport(
  payload: TemplateSharePayloadV1,
): Promise<void> {
  validateTemplateSharePayload(payload);
  return withMutationQueue(async () => {
    const storage = getStorage();
    const stored = await storage.get(STORAGE_KEY);
    const queue = readValidQueue(stored[STORAGE_KEY]);
    if (queue.length >= MAX_PENDING_IMPORTS) {
      throw new UserFacingError(
        "대기 중인 템플릿이 5개입니다. LinKU를 열어 가져오기를 마친 뒤 다시 시도해 주세요.",
      );
    }
    await storage.set({
      [STORAGE_KEY]: [...queue, payload],
    });
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

    const failed: TemplateSharePayloadV1[] = [];
    let importedCount = 0;
    for (const payload of queue) {
      try {
        await importer(payload);
        importedCount += 1;
      } catch (error) {
        errorLog("Failed to consume pending template import", error);
        failed.push(payload);
      }
    }

    if (failed.length > 0) {
      await storage.set({ [STORAGE_KEY]: failed });
    } else {
      await storage.remove(STORAGE_KEY);
    }
    return { importedCount, failedCount: failed.length };
  });
}
