import assert from "node:assert/strict";
import test from "node:test";

import {
  isTransientChromeStorageLock,
  isTransientTabEditError,
  retryChromeOperation,
} from "../../src/utils/chromeRetry.ts";

test("탭 드래그 경쟁 조건만 제한적으로 재시도한다", async () => {
  let attempts = 0;
  const waits: number[] = [];

  const result = await retryChromeOperation(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("Tabs cannot be edited right now (user may be dragging a tab). - drag");
      }
      return "updated";
    },
    {
      maxAttempts: 3,
      delayMs: 100,
      shouldRetry: isTransientTabEditError,
      wait: async (delayMs) => {
        waits.push(delayMs);
      },
    },
  );

  assert.equal(result, "updated");
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [100, 200]);
});

test("일시적인 Chrome storage LOCK 오류를 식별한다", () => {
  assert.equal(
    isTransientChromeStorageLock(
      new Error("IO error: /LOCK: Access denied. (ChromeMethodBFE: 15::LockFile::5)"),
    ),
    true,
  );
  assert.equal(isTransientChromeStorageLock(new Error("Quota exceeded")), false);
});

test("재시도 대상이 아닌 오류는 즉시 전달한다", async () => {
  let attempts = 0;

  await assert.rejects(
    retryChromeOperation(
      async () => {
        attempts += 1;
        throw new Error("No tab with id: 42");
      },
      {
        maxAttempts: 3,
        delayMs: 100,
        shouldRetry: isTransientTabEditError,
        wait: async () => undefined,
      },
    ),
    /No tab with id/u,
  );
  assert.equal(attempts, 1);
});
