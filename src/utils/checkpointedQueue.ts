export interface CheckpointedQueueResult {
  completedCount: number;
  failedCount: number;
}

export type QueueFailureDisposition = "retry" | "discard";

interface QueueStorage {
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export type QueueAppendStatus = "added" | "duplicate" | "full";

export function planUniqueQueueAppend<T>(
  queue: readonly T[],
  entry: T,
  capacity: number,
  keyOf: (value: T) => string,
): { status: QueueAppendStatus; queue: T[] } {
  const entryKey = keyOf(entry);
  if (queue.some((candidate) => keyOf(candidate) === entryKey)) {
    return { status: "duplicate", queue: [...queue] };
  }
  if (queue.length >= capacity) {
    return { status: "full", queue: [...queue] };
  }
  return { status: "added", queue: [...queue, entry] };
}

export async function writeCheckpointedQueue<T>(
  storage: QueueStorage,
  key: string,
  queue: readonly T[],
): Promise<void> {
  if (queue.length > 0) {
    await storage.set({ [key]: queue });
  } else {
    await storage.remove(key);
  }
}

/** At-least-once processing: a failed checkpoint may retry a completed entry. */
export async function consumeCheckpointedQueue<T>(
  queue: readonly T[],
  consume: (entry: T) => Promise<void>,
  checkpoint: (remaining: T[]) => Promise<void>,
  onFailure: (
    error: unknown,
    entry: T,
  ) => QueueFailureDisposition | void,
): Promise<CheckpointedQueueResult> {
  const failed: T[] = [];
  let completedCount = 0;

  for (const [index, entry] of queue.entries()) {
    try {
      await consume(entry);
      completedCount += 1;
    } catch (error) {
      const disposition = onFailure(error, entry);
      if (disposition !== "discard") {
        failed.push(entry);
      }
    }

    await checkpoint([...failed, ...queue.slice(index + 1)]);
  }

  return { completedCount, failedCount: failed.length };
}
