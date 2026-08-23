export interface CheckpointedQueueResult {
  completedCount: number;
  failedCount: number;
}

interface QueueStorage {
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
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
  onFailure: (error: unknown) => void,
): Promise<CheckpointedQueueResult> {
  const failed: T[] = [];
  let completedCount = 0;

  for (const [index, entry] of queue.entries()) {
    try {
      await consume(entry);
      completedCount += 1;
    } catch (error) {
      onFailure(error);
      failed.push(entry);
    }

    await checkpoint([...failed, ...queue.slice(index + 1)]);
  }

  return { completedCount, failedCount: failed.length };
}
