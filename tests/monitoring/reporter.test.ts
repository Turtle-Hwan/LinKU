import assert from "node:assert/strict";
import test from "node:test";

import { normalizeError } from "../../src/monitoring/normalizeError.ts";
import {
  createMonitoringReporter,
  type ReportOptions,
} from "../../src/monitoring/reporter.ts";
import type { MonitoringCollector } from "../../src/monitoring/types.ts";
import { createCollector } from "./testCollector.ts";

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

test("오류 객체의 message getter가 실패해도 fallback으로 정규화한다", () => {
  const rejection = Object.defineProperty({}, "message", {
    get() {
      throw new Error("getter failed");
    },
  });

  const normalized = normalizeError(rejection, "safe fallback");

  assert.equal(normalized.error.message, "safe fallback");
  assert.equal(normalized.originalValue, rejection);
});

test("collector와 caller context가 실패해도 제품 오류로 전파하지 않는다", async () => {
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
      return Promise.reject(new Error("flush failed"));
    },
  };
  const reporter = createMonitoringReporter(throwingCollector);
  const invalidOptions = new Proxy(
    { feature: "invalid_context" } as ReportOptions,
    {
      get() {
        throw new Error("context getter failed");
      },
      ownKeys() {
        throw new Error("context keys failed");
      },
    },
  );

  assert.equal(reporter.init("popup"), false);
  assert.doesNotThrow(() => {
    reporter.reportError(new Error("product failed"), {
      feature: "product_error",
    });
    reporter.reportMessage("product warning", {
      feature: "product_warning",
      level: "warning",
    });
    reporter.reportError(new Error("invalid context"), invalidOptions);
    reporter.reportMessage("invalid context", invalidOptions);
    reporter.createErrorReporter({ category: "test" })(
      new Error("invalid defaults merge"),
      invalidOptions,
    );
  });
  assert.equal(await reporter.flush(), false);
});

test("초기화한 runtime에 같은 전역 오류 경계를 한 번만 설치한다", () => {
  const { collector, calls } = createCollector();
  const listeners = new Map<string, (event: Event) => void>();
  let listenerInstallCount = 0;
  const reporter = createMonitoringReporter(collector, {
    runtimeGlobal: {
      addEventListener(type, listener) {
        listenerInstallCount += 1;
        listeners.set(type, listener);
      },
    },
  });

  assert.equal(reporter.init("background"), true);
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

  assert.deepEqual(calls.init, ["background", "background"]);
  assert.equal(listenerInstallCount, 2);
  assert.equal(calls.exceptions.length, 2);
  assert.equal(calls.exceptions[0]?.context?.handled, false);
  assert.equal(calls.exceptions[0]?.context?.mechanism, "global.onerror");
  assert.equal(calls.exceptions[1]?.context?.handled, false);
  assert.equal(
    calls.exceptions[1]?.context?.mechanism,
    "global.onunhandledrejection",
  );
});
