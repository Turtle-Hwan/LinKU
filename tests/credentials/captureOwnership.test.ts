import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "vite";

type CaptureCall = {
  error: unknown;
  options: Record<string, unknown>;
};

type CaptureCalls = {
  errors: CaptureCall[];
  breadcrumbs: Array<Record<string, unknown>>;
};

type CredentialModules = {
  chrome: typeof import("../../src/utils/chrome.ts");
  clientId: typeof import("../../src/utils/clientId.ts");
  crypto: typeof import("../../src/utils/crypto.ts");
  credentials: typeof import("../../src/utils/credentials.ts");
};

const runtimeState: { lastError?: { message?: string } } = {};

function installChromeStorage(
  methods: Partial<{
    get: (key: string, callback: (data: Record<string, unknown>) => void) => void;
    set: (data: Record<string, unknown>, callback: () => void) => void;
    remove: (key: string | string[], callback: () => void) => void;
  }>,
): void {
  globalThis.chrome = {
    runtime: runtimeState,
    storage: {
      local: {
        get: methods.get,
        set: methods.set,
        remove: methods.remove,
      },
    },
  } as unknown as typeof chrome;
}

function failWithLastError(callback: () => void): void {
  runtimeState.lastError = { message: "storage is locked" };
  callback();
  runtimeState.lastError = undefined;
}

function resetCalls(calls: CaptureCalls): void {
  calls.errors.length = 0;
  calls.breadcrumbs.length = 0;
}

test("storage와 credential 오류는 최종 처리 경계에서 원본 Error로 한 번만 수집한다", async () => {
  const calls: CaptureCalls = { errors: [], breadcrumbs: [] };
  const testGlobal = globalThis as typeof globalThis & {
    __captureOwnerTestCalls?: CaptureCalls;
  };
  const previousChrome = globalThis.chrome;
  const previousCalls = testGlobal.__captureOwnerTestCalls;
  const runtimeConsole = Reflect.get(globalThis, "console") as Console;
  const previousConsoleError = runtimeConsole.error;
  const previousConsoleWarn = runtimeConsole.warn;
  testGlobal.__captureOwnerTestCalls = calls;
  runtimeConsole.error = () => undefined;
  runtimeConsole.warn = () => undefined;

  const server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
    plugins: [
      {
        name: "credential-capture-owner-test",
        enforce: "pre",
        resolveId(id) {
          return id.endsWith("/src/monitoring")
            ? "\0credential-monitoring-stub"
            : null;
        },
        load(id) {
          if (id !== "\0credential-monitoring-stub") return null;

          return `
            const calls = () => globalThis.__captureOwnerTestCalls;
            export const reportError = (error, options) => {
              calls().errors.push({ error, options });
            };
            export const createErrorReporter = (defaults = {}) =>
              (error, options) => reportError(error, { ...defaults, ...options });
            export const recordBreadcrumb = (category, message, data, level) => {
              calls().breadcrumbs.push({ category, message, data, level });
            };
            export const reportMessage = () => undefined;
            export const initMonitoring = () => true;
            export const flushMonitoring = async () => true;
          `;
        },
      },
    ],
  });

  try {
    const modules: CredentialModules = {
      chrome: await server.ssrLoadModule("/src/utils/chrome.ts"),
      clientId: await server.ssrLoadModule("/src/utils/clientId.ts"),
      crypto: await server.ssrLoadModule("/src/utils/crypto.ts"),
      credentials: await server.ssrLoadModule("/src/utils/credentials.ts"),
    };

    installChromeStorage({
      get: (_key, callback) => failWithLastError(() => callback({})),
    });
    await assert.rejects(
      modules.chrome.getStorage("value"),
      (error: unknown) =>
        error instanceof Error &&
        error.name === "ChromeRuntimeError" &&
        error.message === "storage is locked",
    );
    assert.equal(calls.errors.length, 0, "rejecting storage wrapper must not capture");

    resetCalls(calls);
    await assert.rejects(modules.clientId.getOrCreatePersistentClientId());
    assert.equal(calls.errors.length, 0, "strict client ID path must not capture");

    resetCalls(calls);
    const fallbackClientId = await modules.clientId.getOrCreateClientId();
    assert.match(fallbackClientId, /^error-/u);
    assert.equal(calls.errors.length, 0, "analytics fallback must not create an issue");
    assert.equal(calls.breadcrumbs.length, 1);

    resetCalls(calls);
    await assert.rejects(
      modules.crypto.encryptPassword("plain-password"),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "비밀번호 암호화에 실패했습니다." &&
        error.cause instanceof Error,
    );
    assert.equal(calls.errors.length, 0, "rethrowing crypto layer must not capture");

    resetCalls(calls);
    await assert.rejects(
      modules.credentials.saveCredentials("credentials", "student", "plain-password"),
    );
    assert.equal(calls.errors.length, 0, "rethrowing credential save must not capture");

    resetCalls(calls);
    assert.equal(await modules.credentials.loadCredentials("credentials"), null);
    assert.equal(calls.errors.length, 1, "swallowed credential load must capture once");
    assert.ok(calls.errors[0]?.error instanceof Error);

    resetCalls(calls);
    installChromeStorage({
      remove: (_key, callback) => failWithLastError(callback),
    });
    await assert.rejects(modules.credentials.clearCredentials("credentials"));
    assert.equal(calls.errors.length, 0, "rethrowing credential clear must not capture");

    resetCalls(calls);
    const encryptedPassword = `${"a".repeat(32)}:${"b".repeat(24)}:AA==`;
    installChromeStorage({
      get: (key, callback) => {
        callback(
          key === "clientId"
            ? { clientId: "stable-client-id" }
            : {
                credentials: {
                  id: "student",
                  password: encryptedPassword,
                },
              },
        );
      },
    });
    assert.equal(await modules.credentials.loadCredentials("credentials"), null);
    assert.equal(calls.errors.length, 1, "discarded ciphertext must capture once");
    assert.ok(calls.errors[0]?.error instanceof Error);
    assert.equal(
      (calls.errors[0]?.error as Error).message,
      "비밀번호 복호화에 실패했습니다.",
    );
  } finally {
    await server.close();
    globalThis.chrome = previousChrome;
    testGlobal.__captureOwnerTestCalls = previousCalls;
    runtimeConsole.error = previousConsoleError;
    runtimeConsole.warn = previousConsoleWarn;
  }
});
