import assert from "node:assert/strict";
import test from "node:test";

import {
  getUserFacingErrorMessage,
  UserFacingError,
} from "../../src/errors/userFacingError.ts";

test("명시한 오류만 사용자 문구로 노출한다", () => {
  assert.equal(
    getUserFacingErrorMessage(
      new UserFacingError("에브리타임 로그인이 필요합니다."),
      "fallback",
    ),
    "에브리타임 로그인이 필요합니다.",
  );
  assert.equal(
    getUserFacingErrorMessage(
      new Error("https://internal.example/path?token=secret"),
      "안전한 오류 문구",
    ),
    "안전한 오류 문구",
  );
});
