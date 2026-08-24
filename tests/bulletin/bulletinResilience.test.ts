import assert from "node:assert/strict";
import test from "node:test";

import { resolveLatestBulletin } from "../../src/apis/external/bulletin.ts";
import {
  capturedErrors,
  consoleWarnings,
  resetRuntimeStubs,
} from "../helpers/runtimeStubs.ts";

const CACHE_KEY = "linku:latest-bulletin:v1";

const installStorage = () => {
  const setCalls: Record<string, unknown>[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: async () => ({}),
          set: async (value: Record<string, unknown>) => {
            setCalls.push(value);
          },
        },
      },
    },
  });

  return {
    setCalls,
    restore: () => {
      if (previous) {
        Object.defineProperty(globalThis, "chrome", previous);
      } else {
        Reflect.deleteProperty(globalThis, "chrome");
      }
    },
  };
};

const waitForFetches = () => new Promise<void>((resolve) => setImmediate(resolve));

test("전송 실패는 미확인과 구분해 7일 checkedAt을 저장하지 않는다", async (t) => {
  resetRuntimeStubs();
  const storage = installStorage();
  let fetchCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCalls += 1;
    throw new TypeError("Failed to fetch");
  });

  try {
    await resolveLatestBulletin(new Date("2027-01-10T00:00:00Z"));
    await waitForFetches();

    assert.equal(fetchCalls, 1);
    assert.deepEqual(storage.setCalls, []);
    assert.deepEqual(capturedErrors, []);
    assert.equal(consoleWarnings.length, 1);
  } finally {
    storage.restore();
  }
});

test("404로 확인된 미존재 연도만 7일 checkedAt을 저장한다", async (t) => {
  resetRuntimeStubs();
  const storage = installStorage();
  let fetchCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCalls += 1;
    return new Response(null, { status: 404 });
  });
  const now = new Date("2028-01-10T00:00:00Z");

  try {
    await resolveLatestBulletin(now);
    await waitForFetches();

    assert.equal(fetchCalls, 2);
    assert.deepEqual(storage.setCalls, [
      {
        [CACHE_KEY]: {
          resolvedYear: 2026,
          attemptedYear: 2028,
          checkedAt: now.getTime(),
        },
      },
    ]);
    assert.deepEqual(capturedErrors, []);
  } finally {
    storage.restore();
  }
});

test("외부 503 응답도 이슈와 장기 미확인 캐시를 만들지 않는다", async (t) => {
  resetRuntimeStubs();
  const storage = installStorage();
  let fetchCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCalls += 1;
    return new Response(null, { status: 503 });
  });

  try {
    await resolveLatestBulletin(new Date("2029-01-10T00:00:00Z"));
    await waitForFetches();

    assert.equal(fetchCalls, 2);
    assert.deepEqual(storage.setCalls, []);
    assert.deepEqual(capturedErrors, []);
    assert.equal(consoleWarnings.length, 2);
  } finally {
    storage.restore();
  }
});

test("200 응답의 웹방화벽 차단문도 미존재로 캐시하지 않는다", async (t) => {
  resetRuntimeStubs();
  const storage = installStorage();
  let fetchCalls = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    fetchCalls += 1;
    return {
      status: 200,
      url: input.toString(),
      text: async () => "<html><h2>웹 공격 차단</h2></html>",
    } as Response;
  });

  try {
    await resolveLatestBulletin(new Date("2030-01-10T00:00:00Z"));
    await waitForFetches();

    assert.equal(fetchCalls, 2);
    assert.deepEqual(storage.setCalls, []);
    assert.deepEqual(capturedErrors, []);
  } finally {
    storage.restore();
  }
});
