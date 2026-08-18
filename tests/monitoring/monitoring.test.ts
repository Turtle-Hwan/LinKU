import assert from "node:assert/strict";
import test from "node:test";

import {
  isSensitiveKey,
  redactSensitiveString,
  redactSensitiveUrl,
} from "../../src/monitoring/redaction.ts";
import { createMonitoringReporter } from "../../src/monitoring/reporter.ts";
import {
  createRuntimeMessageResponder,
  getRuntimeMessageType,
} from "../../src/monitoring/runtimeMessage.ts";
import type {
  CaptureContext,
  MonitoringCollector,
  MonitoringLevel,
  MonitoringRuntime,
} from "../../src/monitoring/types.ts";
import {
  getUserFacingErrorMessage,
  UserFacingError,
} from "../../src/errors/userFacingError.ts";

type CollectorCalls = {
  init: MonitoringRuntime[];
  exceptions: Array<{ error: Error; context?: CaptureContext }>;
  messages: Array<{
    message: string;
    level?: MonitoringLevel;
    context?: CaptureContext;
  }>;
  breadcrumbs: Array<{
    category: string;
    message: string;
    data?: Record<string, unknown>;
    level?: MonitoringLevel;
  }>;
  flushes: number[];
};

function createCollector(): {
  collector: MonitoringCollector;
  calls: CollectorCalls;
} {
  const calls: CollectorCalls = {
    init: [],
    exceptions: [],
    messages: [],
    breadcrumbs: [],
    flushes: [],
  };

  return {
    calls,
    collector: {
      init(runtime) {
        calls.init.push(runtime);
        return { initialized: true, extensionVersion: "1.2.3" };
      },
      captureException(error, context) {
        calls.exceptions.push({ error, context });
      },
      captureMessage(message, level, context) {
        calls.messages.push({ message, level, context });
      },
      addBreadcrumb(category, message, data, level) {
        calls.breadcrumbs.push({ category, message, data, level });
      },
      flush(timeout = 2_000) {
        calls.flushes.push(timeout);
        return Promise.resolve(true);
      },
    },
  };
}

test("공통 reporter가 breadcrumb, 예외 문맥, flush 정책을 함께 적용한다", () => {
  const { collector, calls } = createCollector();
  const reporter = createMonitoringReporter(collector);
  const reportApiError = reporter.createErrorReporter({
    category: "api.error",
    mechanism: "fetch",
    tags: { layer: "api" },
    extras: { shared: true },
  });

  reportApiError(new Error("network failed"), {
    feature: "api_network_error",
    breadcrumbMessage: "request failed",
    tags: { method: "GET" },
    extras: { status: 503 },
  });

  assert.equal(calls.breadcrumbs.length, 1);
  assert.deepEqual(calls.breadcrumbs[0], {
    category: "api.error",
    message: "request failed",
    data: { shared: true, status: 503 },
    level: "error",
  });
  assert.equal(calls.exceptions.length, 1);
  assert.equal(calls.exceptions[0]?.error.message, "network failed");
  assert.deepEqual(calls.exceptions[0]?.context, {
    feature: "api_network_error",
    tags: { layer: "api", method: "GET" },
    extras: { shared: true, status: 503 },
    context: undefined,
    handled: undefined,
    mechanism: "fetch",
    level: "error",
  });
  assert.deepEqual(calls.flushes, [2_000]);
});

test("Error가 아닌 rejection도 안전한 Error와 원본 문맥으로 정규화한다", () => {
  const { collector, calls } = createCollector();
  const reporter = createMonitoringReporter(collector);
  const rejection = { message: "request failed", code: "E_REQUEST" };

  reporter.reportError(rejection, {
    feature: "unhandled_rejection",
    handled: false,
    mechanism: "global.onunhandledrejection",
  });

  assert.equal(calls.exceptions[0]?.error.message, "request failed");
  assert.equal(calls.exceptions[0]?.context?.handled, false);
  assert.deepEqual(calls.exceptions[0]?.context?.extras, {
    original_error: rejection,
  });
});

test("collector 자체가 실패해도 제품 오류로 전파하지 않는다", () => {
  const throwingCollector: MonitoringCollector = {
    init() {
      throw new Error("init failed");
    },
    captureException() {
      throw new Error("capture failed");
    },
    captureMessage() {
      throw new Error("capture failed");
    },
    addBreadcrumb() {
      throw new Error("breadcrumb failed");
    },
    flush() {
      throw new Error("flush failed");
    },
  };
  const reporter = createMonitoringReporter(throwingCollector);

  assert.equal(reporter.init("popup"), false);
  assert.doesNotThrow(() => {
    reporter.reportError(new Error("product failed"), {
      feature: "product_error",
    });
    reporter.reportMessage("product warning", {
      feature: "product_warning",
      level: "warning",
    });
  });
});

test("초기화한 모든 runtime에 같은 전역 오류 경계를 설치한다", () => {
  const { collector, calls } = createCollector();
  const listeners = new Map<string, (event: Event) => void>();
  const reporter = createMonitoringReporter(collector, {
    runtimeGlobal: {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
    },
  });

  assert.equal(reporter.init("background"), true);
  listeners.get("error")?.({
    error: new Error("service worker crashed"),
    message: "service worker crashed",
    filename: "background.js",
    lineno: 12,
    colno: 4,
  } as unknown as Event);
  listeners.get("unhandledrejection")?.({
    reason: "promise failed",
  } as unknown as Event);

  assert.deepEqual(calls.init, ["background"]);
  assert.equal(calls.exceptions.length, 2);
  assert.equal(calls.exceptions[0]?.context?.handled, false);
  assert.equal(calls.exceptions[0]?.context?.mechanism, "global.onerror");
  assert.equal(calls.exceptions[1]?.context?.handled, false);
  assert.equal(
    calls.exceptions[1]?.context?.mechanism,
    "global.onunhandledrejection",
  );
});

test("runtime responder는 첫 응답만 보내고 중복과 전송 실패를 수집한다", () => {
  const { collector, calls } = createCollector();
  const reporter = createMonitoringReporter(collector);
  const responses: unknown[] = [];
  const respond = createRuntimeMessageResponder(reporter, {
    runtime: "background",
    messageType: "LINKU_TEST",
    sendResponse(response) {
      responses.push(response);
    },
  });

  respond({ success: true });
  respond({ success: false, error: "duplicate" });

  assert.deepEqual(responses, [{ success: true }]);
  assert.deepEqual(calls.breadcrumbs[0], {
    category: "background.message",
    message: "response sent",
    data: {
      message_type: "LINKU_TEST",
      success: true,
      has_error: false,
    },
    level: "info",
  });
  assert.equal(calls.messages[0]?.context?.feature, "runtime_message_response_duplicate");

  const failedRespond = createRuntimeMessageResponder(reporter, {
    runtime: "content",
    messageType: "LINKU_FAIL",
    sendResponse() {
      throw new Error("port closed");
    },
  });
  failedRespond({ success: false });

  assert.equal(calls.exceptions[0]?.context?.feature, "runtime_message_response");
  assert.equal(calls.exceptions[0]?.context?.mechanism, "runtime.sendResponse");
  assert.equal(getRuntimeMessageType({ type: "LINKU_TEST" }), "LINKU_TEST");
  assert.equal(getRuntimeMessageType({ type: 1 }), "invalid");
});

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
