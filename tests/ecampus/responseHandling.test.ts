import assert from "node:assert/strict";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

import { createServer, type Plugin, type ViteDevServer } from "vite";

type MonitoringCalls = {
  errors: Array<{ error: unknown; options?: Record<string, unknown> }>;
  messages: Array<{ message: string; options?: Record<string, unknown> }>;
  breadcrumbs: Array<{
    category: string;
    message: string;
    data?: Record<string, unknown>;
    level?: string;
  }>;
};

type ClientModule = typeof import("../../src/apis/client.ts");
type ECampusModule = typeof import("../../src/apis/external/ecampus.ts");

const MONITORING_CALLS_KEY = "__linkuMonitoringTestCalls";
const runtime = globalThis as typeof globalThis & Record<string, unknown>;
const monitoringCalls: MonitoringCalls = {
  errors: [],
  messages: [],
  breadcrumbs: [],
};

const originalChrome = globalThis.chrome;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const testConsole = globalThis.console;
const originalConsoleError = testConsole.error;
const originalConsoleWarn = testConsole.warn;

let server: ViteDevServer;
let client: ClientModule;
let ecampus: ECampusModule;
let dispatchedEvents: string[] = [];

function monitoringStub(): Plugin {
  const virtualId = "\0linku-monitoring-test-stub";

  return {
    name: "linku-monitoring-test-stub",
    enforce: "pre",
    resolveId(id) {
      const normalizedId = id.replaceAll("\\", "/");
      return id === "@/monitoring" ||
        normalizedId.endsWith("/src/monitoring") ||
        normalizedId.endsWith("/src/monitoring/index.ts")
        ? virtualId
        : undefined;
    },
    load(id) {
      if (id !== virtualId) return undefined;

      return `
        const calls = globalThis.${MONITORING_CALLS_KEY};
        export function recordBreadcrumb(category, message, data, level) {
          calls.breadcrumbs.push({ category, message, data, level });
        }
        export function reportError(error, options) {
          calls.errors.push({ error, options });
        }
        export function reportMessage(message, options) {
          calls.messages.push({ message, options });
        }
        export function createErrorReporter(defaults = {}) {
          return (error, options) => reportError(error, {
            ...defaults,
            ...options,
            tags: { ...defaults.tags, ...options.tags },
            extras: { ...defaults.extras, ...options.extras },
          });
        }
      `;
    },
  };
}

function installChrome(
  sendMessage: (message: unknown) => Promise<unknown> = async () => ({
    success: false,
  }),
): void {
  globalThis.chrome = {
    runtime: {
      id: "linku-response-test",
      sendMessage,
    },
    storage: {
      local: {
        get(_key: unknown, callback: (data: Record<string, unknown>) => void) {
          callback({});
        },
        remove(_keys: unknown, callback?: () => void) {
          callback?.();
        },
      },
    },
  } as unknown as typeof chrome;
}

function installWindow(): void {
  runtime.window = {
    location: { origin: "chrome-extension://linku-response-test" },
    dispatchEvent(event: Event) {
      dispatchedEvents.push(event.type);
      return true;
    },
  };
}

function mockFetch(response: Response): void {
  globalThis.fetch = (async () => response) as typeof fetch;
}

before(async () => {
  runtime[MONITORING_CALLS_KEY] = monitoringCalls;
  testConsole.error = () => undefined;
  testConsole.warn = () => undefined;
  installChrome();
  installWindow();

  server = await createServer({
    root: process.cwd(),
    configFile: false,
    mode: "test",
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
      },
    },
    plugins: [monitoringStub()],
  });
  client = await server.ssrLoadModule("/src/apis/client.ts") as ClientModule;
  ecampus = await server.ssrLoadModule(
    "/src/apis/external/ecampus.ts",
  ) as ECampusModule;
});

beforeEach(() => {
  monitoringCalls.errors.length = 0;
  monitoringCalls.messages.length = 0;
  monitoringCalls.breadcrumbs.length = 0;
  dispatchedEvents = [];
  installChrome();
  installWindow();
  globalThis.fetch = originalFetch;
});

after(async () => {
  await server?.close();
  testConsole.error = originalConsoleError;
  testConsole.warn = originalConsoleWarn;
  globalThis.fetch = originalFetch;
  globalThis.chrome = originalChrome;

  if (originalWindow === undefined) {
    delete runtime.window;
  } else {
    runtime.window = originalWindow;
  }
  delete runtime[MONITORING_CALLS_KEY];
});

test("LinKU API 5xx HTML은 parse defect 대신 HTTP issue 하나로 끝난다", async () => {
  mockFetch(new Response("<html>upstream failed</html>", {
    status: 503,
    headers: { "content-type": "application/json" },
  }));

  const result = await client.get("https://api.example.test/alerts");

  assert.equal(result.success, false);
  assert.equal(result.status, 503);
  assert.equal(result.error?.code, "503");
  assert.equal(monitoringCalls.errors.length, 0);
  assert.equal(monitoringCalls.messages.length, 1);
  assert.equal(
    monitoringCalls.messages[0]?.options?.feature,
    "api_http_error",
  );
});

test("LinKU API 4xx user code는 breadcrumb-only outcome이다", async () => {
  mockFetch(new Response(JSON.stringify({ code: 5015, message: "invalid" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  }));

  const result = await client.post("https://api.example.test/auth/verify");

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "5015");
  assert.equal(monitoringCalls.errors.length, 0);
  assert.equal(monitoringCalls.messages.length, 0);
  assert.ok(
    monitoringCalls.breadcrumbs.some(
      ({ message }) => message === "non-success HTTP response",
    ),
  );
});

test("LinKU API 2xx invalid JSON은 parse issue 하나를 남긴다", async () => {
  mockFetch(new Response("not-json", {
    status: 200,
    headers: { "content-type": "application/json" },
  }));

  const result = await client.get("https://api.example.test/alerts");

  assert.equal(result.success, false);
  assert.equal(result.error?.code, "PARSE_ERROR");
  assert.equal(monitoringCalls.messages.length, 0);
  assert.equal(monitoringCalls.errors.length, 1);
  assert.equal(
    monitoringCalls.errors[0]?.options?.feature,
    "api_response_parse",
  );
});

test("token expiry와 정상 재인증 실패는 issue를 만들지 않는다", async () => {
  installChrome(async () => ({ success: false, error: "cancelled" }));
  mockFetch(new Response(JSON.stringify({ code: 5004 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));

  const result = await client.get("https://api.example.test/alerts");

  assert.equal(result.success, false);
  assert.equal(result.status, 401);
  assert.equal(result.error?.code, "5004");
  assert.deepEqual(dispatchedEvents, ["auth:unauthorized"]);
  assert.equal(monitoringCalls.errors.length, 0);
  assert.equal(monitoringCalls.messages.length, 0);
});

test("재인증 message channel 예외는 client terminal issue 하나가 소유한다", async () => {
  installChrome(async () => {
    throw new Error("message channel closed");
  });
  mockFetch(new Response(JSON.stringify({ code: 5004 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));

  const result = await client.get("https://api.example.test/alerts");

  assert.equal(result.success, false);
  assert.equal(monitoringCalls.messages.length, 0);
  assert.equal(monitoringCalls.errors.length, 1);
  assert.equal(
    monitoringCalls.errors[0]?.options?.feature,
    "silent_reauth_request",
  );
});

test("eCampus non-2xx login은 status outcome으로 분리한다", async () => {
  mockFetch(new Response("maintenance", { status: 503 }));

  const result = await ecampus.eCampusLoginAPI("student", "password");

  assert.equal(result.success, false);
  assert.match(result.error ?? "", /503/u);
  assert.equal(monitoringCalls.errors.length, 0);
  assert.equal(monitoringCalls.messages.length, 0);
  assert.ok(
    monitoringCalls.breadcrumbs.some(
      ({ message }) => message === "login request returned non-success status",
    ),
  );
});

test("eCampus expected transport failure는 issue에서 제외한다", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;

  const result = await ecampus.eCampusLoginAPI("student", "password");

  assert.equal(result.success, false);
  assert.equal(monitoringCalls.errors.length, 0);
  assert.ok(
    monitoringCalls.breadcrumbs.some(
      ({ message, data }) =>
        message === "login request transport failed" &&
        data?.network_failure_kind === "blocked_or_unreachable",
    ),
  );
});

test("eCampus login timeout은 일반 transport와 별도 outcome이다", async () => {
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = ((callback: TimerHandler) => {
    queueMicrotask(() => {
      if (typeof callback === "function") callback();
    });
    return 1;
  }) as typeof globalThis.setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof globalThis.clearTimeout;
  globalThis.fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
    const rejectAsAborted = () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      reject(error);
    };
    if (init?.signal?.aborted) {
      rejectAsAborted();
      return;
    }
    init?.signal?.addEventListener("abort", rejectAsAborted, { once: true });
  })) as typeof fetch;

  try {
    const result = await ecampus.eCampusLoginAPI("student", "password");

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /시간이 초과/u);
    assert.equal(monitoringCalls.errors.length, 0);
    assert.ok(
      monitoringCalls.breadcrumbs.some(
        ({ message }) => message === "login request timed out",
      ),
    );
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
  }
});

test("eCampus 200 invalid payload는 integration issue 하나가 소유한다", async () => {
  mockFetch(new Response("<html>login page</html>", { status: 200 }));

  const result = await ecampus.eCampusLoginAPI("student", "password");

  assert.equal(result.success, false);
  assert.equal(monitoringCalls.messages.length, 0);
  assert.equal(monitoringCalls.errors.length, 1);
  assert.equal(
    monitoringCalls.errors[0]?.options?.feature,
    "handled_error",
  );
});

test("eCampus credential rejection은 정상 auth outcome이다", async () => {
  mockFetch(new Response(
    'jsonLogin({"isError":true,"message":"invalid credentials"});',
    { status: 200 },
  ));

  const result = await ecampus.eCampusLoginAPI("student", "wrong-password");

  assert.equal(result.success, false);
  assert.equal(result.data?.isError, true);
  assert.equal(monitoringCalls.errors.length, 0);
  assert.equal(monitoringCalls.messages.length, 0);
});

test("eCampus lecture URL 생성은 capture 없는 pure outcome이다", async () => {
  const result = await ecampus.eCampusGoLectureAPI("KJ", "SEQ", "report");

  assert.deepEqual(result, {
    success: true,
    isError: false,
    message: "/ilos/mp/todo_list_connect.acl?SEQ=SEQ&gubun=report&KJKEY=KJ",
  });
  assert.equal(monitoringCalls.errors.length, 0);
  assert.equal(monitoringCalls.messages.length, 0);
});
