import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createServer } from "vite";

type MonitoringCalls = {
  errors: unknown[];
  breadcrumbs: Array<{ category: string; message: string }>;
};

test("analytics storage 잠금은 issue 없이 lifecycle open을 계속 전송한다", async () => {
  const calls: MonitoringCalls = { errors: [], breadcrumbs: [] };
  const dispatched: unknown[] = [];
  const testGlobal = globalThis as typeof globalThis & {
    __analyticsLifecycleCalls?: MonitoringCalls;
  };
  const previousCalls = testGlobal.__analyticsLifecycleCalls;
  const previousChrome = globalThis.chrome;
  const runtimeConsole = Reflect.get(globalThis, "console") as Console;
  const previousConsoleWarn = runtimeConsole.warn;

  testGlobal.__analyticsLifecycleCalls = calls;
  runtimeConsole.warn = () => undefined;

  const runtimeState: { id: string; lastError?: { message: string } } = {
    id: "test-extension-id",
  };

  globalThis.chrome = {
    runtime: {
      ...runtimeState,
      sendMessage: async (message: unknown) => {
        dispatched.push(message);
        return { success: true, mode: "proxy", status: 204 };
      },
      get lastError() {
        return runtimeState.lastError;
      },
    },
    storage: {
      local: {
        get: (_key: string, callback: (data: Record<string, unknown>) => void) => {
          runtimeState.lastError = { message: "storage is locked" };
          callback({});
          runtimeState.lastError = undefined;
        },
      },
    },
  } as unknown as typeof chrome;

  const server = await createServer({
    root: process.cwd(),
    configFile: false,
    mode: "test",
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
    define: {
      "import.meta.env.VITE_GA_PROXY_URL": JSON.stringify(
        "https://analytics.linku.example/collect",
      ),
    },
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    plugins: [
      {
        name: "analytics-lifecycle-monitoring-stub",
        enforce: "pre",
        resolveId(id) {
          return id === "@/monitoring" || id.endsWith("/src/monitoring")
            ? "\0analytics-lifecycle-monitoring-stub"
            : null;
        },
        load(id) {
          if (id !== "\0analytics-lifecycle-monitoring-stub") return null;
          return `
            const calls = () => globalThis.__analyticsLifecycleCalls;
            export const reportError = (error) => calls().errors.push(error);
            export const recordBreadcrumb = (category, message) =>
              calls().breadcrumbs.push({ category, message });
            export const createErrorReporter = () => (error) =>
              calls().errors.push(error);
          `;
        },
      },
    ],
  });

  try {
    const analytics = await server.ssrLoadModule(
      "/src/utils/analytics.ts",
    ) as typeof import("../../src/utils/analytics.ts");

    await analytics.sendExtensionOpen("popup_home", "popup");

    assert.equal(calls.errors.length, 0);
    assert.equal(
      calls.breadcrumbs.filter(({ category }) => category === "analytics.storage").length,
      3,
    );
    assert.equal(dispatched.length, 1);

    const message = dispatched[0] as {
      data?: { payload?: { events?: Array<{ name?: string }> } };
    };
    assert.deepEqual(
      message.data?.payload?.events?.map(({ name }) => name),
      ["extension_open"],
    );
  } finally {
    await server.close();
    globalThis.chrome = previousChrome;
    testGlobal.__analyticsLifecycleCalls = previousCalls;
    runtimeConsole.warn = previousConsoleWarn;
  }
});
