import assert from "node:assert/strict";
import test from "node:test";

import {
  isSensitiveKey,
  redactSensitiveString,
  redactSensitiveUrl,
} from "../../src/monitoring/redaction.ts";

test("로그와 Sentry가 같은 개인정보 제거 정책을 사용한다", () => {
  const redacted = redactSensitiveString(
    'email=user@example.com password="secret" Authorization=Bearer abc.def?token=raw',
  );

  assert.equal(redacted.includes("user@example.com"), false);
  assert.equal(redacted.includes("secret"), false);
  assert.equal(redacted.includes("abc.def"), false);
  assert.equal(redacted.includes("token=raw"), false);
  assert.equal(isSensitiveKey("studentNumber"), true);
  assert.equal(isSensitiveKey("display_name"), true);
  assert.equal(
    redactSensitiveUrl("https://example.com/path?code=oauth-code&view=compact"),
    "https://example.com/path?code=[REDACTED]&view=compact",
  );
});
