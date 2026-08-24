import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyServerTimeSyncFailure,
  ExpectedServerTimeSyncError,
  parseServerDateHeader,
  requestServerTimeSample,
  resolveServerTimeUrl,
} from "../../src/utils/serverTime.ts";

test("서버 시간 URL은 HTTP(S)만 허용한다", () => {
  assert.equal(
    resolveServerTimeUrl(" https://sugang.konkuk.ac.kr "),
    "https://sugang.konkuk.ac.kr/",
  );
  assert.throws(
    () => resolveServerTimeUrl("chrome://extensions"),
    (error: unknown) =>
      error instanceof ExpectedServerTimeSyncError &&
      error.kind === "invalid_url",
  );
});

test("Date 헤더 누락과 잘못된 값을 예상 가능한 실패로 분류한다", () => {
  for (const [value, kind] of [
    [null, "missing_date"],
    ["not-a-date", "invalid_date"],
  ] as const) {
    assert.throws(
      () => parseServerDateHeader(value),
      (error: unknown) =>
        error instanceof ExpectedServerTimeSyncError && error.kind === kind,
    );
  }
});

test("서버 표본은 HEAD 요청의 중간점을 기준으로 오프셋을 계산한다", async () => {
  const times = [1_000, 1_200];
  let requestInit: RequestInit | undefined;
  const controller = new AbortController();
  const sample = await requestServerTimeSample(
    "https://example.com",
    controller.signal,
    async (_url, init) => {
      requestInit = init;
      return {
        headers: {
          get: () => new Date(2_000).toUTCString(),
        },
      };
    },
    () => times.shift() ?? 1_200,
  );

  assert.equal(requestInit?.method, "HEAD");
  assert.equal(requestInit?.cache, "no-store");
  assert.equal(requestInit?.signal, controller.signal);
  assert.deepEqual(sample, {
    offset: 900,
    rtt: 200,
    lastSyncMs: 1_200,
  });
});

test("전송 실패와 abort는 예상 상태, 코드 오류는 unexpected로 분류한다", () => {
  assert.equal(
    classifyServerTimeSyncFailure(new TypeError("Failed to fetch"), false),
    "offline",
  );
  assert.equal(
    classifyServerTimeSyncFailure(new TypeError("Failed to fetch"), true),
    "blocked_or_unreachable",
  );

  const aborted = new Error("The operation was aborted");
  aborted.name = "AbortError";
  assert.equal(classifyServerTimeSyncFailure(aborted, true), "aborted");
  assert.equal(
    classifyServerTimeSyncFailure(new SyntaxError("Unexpected token"), false),
    "unexpected",
  );
});
