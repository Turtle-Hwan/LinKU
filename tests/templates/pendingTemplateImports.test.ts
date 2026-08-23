import assert from "node:assert/strict";
import test from "node:test";
import type { TemplateSharePayloadV1 } from "../../src/types/templateShare.ts";
import {
  consumeCheckpointedQueue,
  writeCheckpointedQueue,
} from "../../src/utils/checkpointedQueue.ts";

const STORAGE_KEY = "pendingTemplateImports";

function payload(name: string): TemplateSharePayloadV1 {
  return {
    version: 1,
    template: { name, height: 1, items: [] },
  };
}

test("대기 가져오기는 각 저장 직후 큐를 체크포인트한다", async () => {
  const first = payload("첫 번째");
  const second = payload("두 번째");
  let stored: TemplateSharePayloadV1[] | undefined = [first, second];
  const checkpoints: TemplateSharePayloadV1[][] = [];
  const observedQueues: TemplateSharePayloadV1[][] = [];
  const storage = {
    set: async (values: Record<string, unknown>) => {
      stored = values[STORAGE_KEY] as TemplateSharePayloadV1[];
      checkpoints.push(stored);
    },
    remove: async () => {
      stored = undefined;
    },
  };

  const result = await consumeCheckpointedQueue(
    stored,
    async (entry) => {
      observedQueues.push(stored ?? []);
      if (entry === second) {
        throw new Error("재시도 테스트");
      }
    },
    (queue) => writeCheckpointedQueue(storage, STORAGE_KEY, queue),
    () => undefined,
  );

  assert.deepEqual(result, { completedCount: 1, failedCount: 1 });
  assert.deepEqual(observedQueues, [[first, second], [second]]);
  assert.deepEqual(checkpoints, [[second], [second]]);
  assert.deepEqual(stored, [second]);
});

test("모든 가져오기가 끝나면 저장 큐를 제거한다", async () => {
  const first = payload("첫 번째");
  const second = payload("두 번째");
  let stored: TemplateSharePayloadV1[] | undefined = [first, second];
  const storage = {
    set: async (values: Record<string, unknown>) => {
      stored = values[STORAGE_KEY] as TemplateSharePayloadV1[];
    },
    remove: async (key: string) => {
      assert.equal(key, STORAGE_KEY);
      stored = undefined;
    },
  };

  const result = await consumeCheckpointedQueue(
    stored,
    async () => undefined,
    (queue) => writeCheckpointedQueue(storage, STORAGE_KEY, queue),
    () => undefined,
  );

  assert.deepEqual(result, { completedCount: 2, failedCount: 0 });
  assert.equal(stored, undefined);
});
