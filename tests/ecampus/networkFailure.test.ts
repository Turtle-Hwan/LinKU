import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyNetworkFailure,
  isExpectedNetworkFailure,
} from "../../src/utils/networkFailure.ts";

test("오프라인과 fetch 차단을 예상 가능한 전송 실패로 분류한다", () => {
  assert.equal(classifyNetworkFailure(new TypeError("Failed to fetch"), false), "offline");
  assert.equal(
    classifyNetworkFailure(new TypeError("Failed to fetch"), true),
    "blocked_or_unreachable",
  );
  assert.equal(isExpectedNetworkFailure(new Error("Load failed"), true), true);
});

test("파싱과 도메인 오류는 네트워크 실패로 오인하지 않는다", () => {
  assert.equal(classifyNetworkFailure(new SyntaxError("Unexpected token"), true), "unknown");
  assert.equal(isExpectedNetworkFailure(new Error("Invalid todo markup"), true), false);
});

test("중단된 요청을 별도 전송 상태로 분류한다", () => {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  assert.equal(classifyNetworkFailure(error, true), "aborted");
});
