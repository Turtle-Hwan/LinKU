import assert from "node:assert/strict";
import test from "node:test";
import type { TemplateSharePayloadV1 } from "../../src/types/templateShare.ts";
import { getTemplateSharePayloadKey } from "../../src/utils/templateShareCodec.ts";
import {
  consumeCheckpointedQueue,
  planUniqueQueueAppend,
  writeCheckpointedQueue,
} from "../../src/utils/checkpointedQueue.ts";

const STORAGE_KEY = "pendingTemplateImports";

function payload(name: string): TemplateSharePayloadV1 {
  return {
    version: 1,
    template: { name, height: 1, items: [] },
  };
}

test("중복 요청은 정원 검사보다 먼저 식별하고 새 요청만 추가한다", () => {
  const first = payload("첫 번째");
  const reordered = {
    template: { items: [], height: 1, name: "첫 번째" },
    version: 1,
  } as TemplateSharePayloadV1;
  const fullQueue = Array.from({ length: 5 }, (_, index) =>
    payload(`${index + 1}번째`),
  );

  assert.deepEqual(
    planUniqueQueueAppend(
      [reordered],
      first,
      5,
      getTemplateSharePayloadKey,
    ),
    { status: "duplicate", queue: [reordered] },
  );
  assert.deepEqual(
    planUniqueQueueAppend([first], first, 5, getTemplateSharePayloadKey),
    { status: "duplicate", queue: [first] },
  );
  assert.equal(
    planUniqueQueueAppend(
      fullQueue,
      fullQueue[0],
      5,
      getTemplateSharePayloadKey,
    ).status,
    "duplicate",
  );
  assert.equal(
    planUniqueQueueAppend(
      fullQueue,
      payload("새 요청"),
      5,
      getTemplateSharePayloadKey,
    ).status,
    "full",
  );
  assert.equal(
    planUniqueQueueAppend(
      [first],
      payload("두 번째"),
      5,
      getTemplateSharePayloadKey,
    ).queue.length,
    2,
  );
});

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
