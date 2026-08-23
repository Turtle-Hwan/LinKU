export interface CheckpointedQueueResult {
  completedCount: number;
  failedCount: number;
}

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
