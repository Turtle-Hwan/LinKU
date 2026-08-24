import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";

import { createServer, type Plugin, type ViteDevServer } from "vite";

const CALLS_KEY = "__linkuLoggerOwnershipCalls";
const runtime = globalThis as typeof globalThis & Record<string, unknown>;
const calls: Array<{ error: unknown; options: Record<string, unknown> }> = [];
let server: ViteDevServer;
let logger: typeof import("../../src/utils/logger.ts");
const testConsole = Reflect.get(globalThis, "console") as Console;
const originalError = testConsole.error;
const originalWarn = testConsole.warn;

function monitoringStub(): Plugin {
  const virtualId = "\0logger-ownership-monitoring-stub";
  return {
    name: "logger-ownership-monitoring-stub",
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
        export function reportError(error, options) {
          globalThis.${CALLS_KEY}.push({ error, options });
        }
      `;
    },
  };
}

before(async () => {
  runtime[CALLS_KEY] = calls;
  testConsole.error = () => undefined;
  testConsole.warn = () => undefined;
  server = await createServer({
    root: process.cwd(),
    configFile: false,
    mode: "test",
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    plugins: [monitoringStub()],
  });
  logger = await server.ssrLoadModule(
    "/src/utils/logger.ts",
  ) as typeof logger;
});

after(async () => {
  await server.close();
  testConsole.error = originalError;
  testConsole.warn = originalWarn;
  delete runtime[CALLS_KEY];
});

test("일반 로그는 수집하지 않고 명시적 capture 함수만 Sentry owner가 된다", () => {
  calls.length = 0;
  const warning = new Error("warning owner");
  const failure = new Error("error owner");

  logger.warnLog("console warning", warning);
  logger.errorLog("console error", failure);
  assert.equal(calls.length, 0);

  logger.captureWarnLog("captured warning", warning);
  logger.captureErrorLog("captured error", failure);

  assert.deepEqual(calls.map(({ error }) => error), [warning, failure]);
  assert.deepEqual(
    calls.map(({ options }) => options.feature),
    ["handled_warning", "handled_error"],
  );
});

test("원본 Error가 없는 계약 오류는 logger 내부 frame을 제거한다", () => {
  calls.length = 0;

  logger.captureErrorLog("captured contract failure", { status: 502 });

  assert.equal(calls.length, 1);
  const captured = calls[0]?.error;
  assert.ok(captured instanceof Error);
  assert.equal(captured.message, "captured contract failure");
  assert.doesNotMatch(captured.stack ?? "", /reportHandledLog|captureErrorLog/u);
});
