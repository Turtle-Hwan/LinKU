import assert from "node:assert/strict";
import test from "node:test";

import { createSerializedAuthQueue } from "../../src/utils/ecampus/authQueue.ts";

test("later account transition supersedes an in-flight login and runs after it", async () => {
  const authQueue = createSerializedAuthQueue();
  let generation = 0;
  let resolveFirstLogin: ((value: string) => void) | undefined;
  let secondLoginStarted = false;

  const firstAttempt = authQueue.run(
    () => generation === 0,
    () =>
      new Promise<string>((resolve) => {
        resolveFirstLogin = resolve;
      }),
  );

  await Promise.resolve();
  generation = 1;

  const secondAttempt = authQueue.run(() => generation === 1, async () => {
    secondLoginStarted = true;
    return "second-account";
  });

  assert.equal(secondLoginStarted, false);
  assert.ok(resolveFirstLogin);
  resolveFirstLogin("first-account");

  assert.deepEqual(await firstAttempt, { superseded: true });
  assert.deepEqual(await secondAttempt, {
    superseded: false,
    result: "second-account",
  });
});

test("superseded login does not start an authentication request", async () => {
  const authQueue = createSerializedAuthQueue();
  let authenticateCalls = 0;

  const attempt = authQueue.run(
    () => false,
    async () => {
      authenticateCalls += 1;
      return "unused";
    },
  );

  assert.deepEqual(await attempt, { superseded: true });
  assert.equal(authenticateCalls, 0);
});
