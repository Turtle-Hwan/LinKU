import assert from "node:assert/strict";
import test from "node:test";

import type { ErrorEvent as SentryErrorEvent } from "@sentry/browser";
import {
  scrubSentryEvent,
  scrubValue,
} from "../../src/monitoring/scrubber.ts";

test("깊게 중첩된 값도 원문 개인정보를 되돌리지 않는다", () => {
  const input = {
    a: {
      b: {
        c: {
          d: {
            e: {
              message: "email=student@example.com password=secret-value",
              deeper: { token: "raw-token" },
            },
          },
        },
      },
    },
  };

  const serialized = JSON.stringify(scrubValue(input));

  assert.equal(serialized.includes("student@example.com"), false);
  assert.equal(serialized.includes("secret-value"), false);
  assert.equal(serialized.includes("raw-token"), false);
  assert.match(serialized, /REDACTED|Truncated/);
});

test("순환 참조와 inspect할 수 없는 값을 안전한 표식으로 바꾼다", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const throwingValue = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      throw new Error("getter failed");
    },
  });

  assert.deepEqual(scrubValue(circular), { self: "[Circular]" });
  assert.deepEqual(scrubValue(throwingValue), {
    value: "[Uninspectable Value]",
  });
});

test("Sentry event 최종 경계에서 request와 모든 주요 문맥을 비식별화한다", () => {
  const event = {
    user: { email: "student@example.com" },
    request: {
      url: "https://example.com/oauth?code=oauth-secret&view=compact",
      headers: { authorization: "Bearer auth-secret" },
      cookies: { session: "cookie-secret" },
      data: { password: "body-secret" },
      query_string: "token=query-secret",
    },
    message: "email=student@example.com password=message-secret",
    logentry: {
      message: "token=logentry-secret",
      params: [{ email: "logentry@example.com" }],
    },
    transaction: "/callback?code=transaction-secret",
    fingerprint: ["email=fingerprint@example.com"],
    tags: { route: "https://example.com?token=tag-secret" },
    contexts: {
      account: { studentNumber: "202612345", name: "safe alias" },
    },
    extra: {
      accessToken: "extra-secret",
      nested: { email: "nested@example.com" },
    },
    breadcrumbs: [
      {
        message: "Authorization=Bearer breadcrumb-secret",
        data: { url: "https://example.com?state=state-secret" },
      },
    ],
    exception: {
      values: [
        {
          value: "password=exception-secret",
          stacktrace: {
            frames: [
              {
                filename: "https://example.com/app.js?token=file-secret",
                abs_path: "https://example.com/app.js?email=path@example.com",
              },
            ],
          },
        },
      ],
    },
  } as SentryErrorEvent;

  const scrubbed = scrubSentryEvent(event);
  const serialized = JSON.stringify(scrubbed);

  assert.notEqual(scrubbed, event);
  assert.notEqual(scrubbed.request, event.request);
  assert.notEqual(scrubbed.exception, event.exception);
  assert.notEqual(scrubbed.breadcrumbs, event.breadcrumbs);
  assert.notEqual(event.user, undefined);
  assert.equal(scrubbed.user, undefined);
  assert.equal(scrubbed.request?.headers, undefined);
  assert.equal(scrubbed.request?.cookies, undefined);
  assert.equal(scrubbed.request?.data, undefined);
  assert.equal(scrubbed.request?.query_string, undefined);
  for (const secret of [
    "student@example.com",
    "oauth-secret",
    "auth-secret",
    "cookie-secret",
    "body-secret",
    "query-secret",
    "message-secret",
    "logentry-secret",
    "logentry@example.com",
    "transaction-secret",
    "fingerprint@example.com",
    "tag-secret",
    "202612345",
    "extra-secret",
    "nested@example.com",
    "breadcrumb-secret",
    "state-secret",
    "exception-secret",
    "file-secret",
    "path@example.com",
  ]) {
    assert.equal(serialized.includes(secret), false, `${secret} was not removed`);
  }
});
