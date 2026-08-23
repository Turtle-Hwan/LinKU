import assert from "node:assert/strict";
import test from "node:test";
import type { TemplateSharePayloadV1 } from "../../src/types/templateShare.ts";
import { consumeCheckpointedQueue } from "../../src/utils/checkpointedQueue.ts";

function payload(name: string): TemplateSharePayloadV1 {
  return {
    version: 1,
    template: { name, height: 1, items: [] },
  };
}

test("대기 가져오기는 각 저장 직후 큐를 체크포인트한다", async () => {
  const first = payload("첫 번째");
  const second = payload("두 번째");
  let remaining = [first, second];
  const checkpoints: TemplateSharePayloadV1[][] = [];

  const result = await consumeCheckpointedQueue(
    remaining,
    async (entry) => {
      if (entry === second) {
        assert.deepEqual(remaining, [second]);
        throw new Error("재시도 테스트");
      }
    },
    async (queue) => {
      remaining = queue;
      checkpoints.push(queue);
    },
    () => undefined,
  );

  assert.deepEqual(result, { completedCount: 1, failedCount: 1 });
  assert.deepEqual(checkpoints, [[second], [second]]);
  assert.deepEqual(remaining, [second]);
});
