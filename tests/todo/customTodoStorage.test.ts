import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const loggerStub = `data:text/javascript,${encodeURIComponent(`
  export const captureErrorLog = () => {};
  export const errorLog = () => {};
  export const getErrorLogDetails = () => ({});
  export const warnLog = () => {};
`)}`;
const monitoringStub = `data:text/javascript,${encodeURIComponent(`
  export const createErrorReporter = () => () => {};
  export const recordBreadcrumb = () => {};
`)}`;
const todoTypeStub = `data:text/javascript,${encodeURIComponent(
  "export const TodoItem = null;",
)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/utils/logger") {
      return { url: loggerStub, shortCircuit: true };
    }
    if (specifier === "@/monitoring") {
      return { url: monitoringStub, shortCircuit: true };
    }
    if (specifier === "@/types/todo") {
      return { url: todoTypeStub, shortCircuit: true };
    }

    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const isRelativeImport =
        specifier.startsWith("./") || specifier.startsWith("../");
      if (isRelativeImport && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  addCustomTodo,
  deleteCustomTodo,
  toggleCustomTodo,
  updateCustomTodo,
} = await import("../../src/utils/todo/customTodo.ts");

test("custom Todo read failure aborts every mutation without writing", async () => {
  const readFailure = new Error("storage read failed");
  let writeCount = 0;
  const previousChrome = globalThis.chrome;

  globalThis.chrome = {
    runtime: {
      id: "custom-todo-test",
      lastError: readFailure,
    },
    storage: {
      local: {
        get(_key, callback) {
          callback({});
        },
        set(_data, callback) {
          writeCount += 1;
          callback?.();
        },
      },
    },
  };

  const mutations = [
    () => addCustomTodo("과제", "2026.08.25", "23:59"),
    () => updateCustomTodo("custom-1", { title: "수정된 과제" }),
    () => deleteCustomTodo("custom-1"),
    () => toggleCustomTodo("custom-1"),
  ];

  try {
    for (const mutate of mutations) {
      await assert.rejects(
        mutate,
        (error) =>
          error instanceof Error &&
          error.name === "ChromeRuntimeError" &&
          error.message === readFailure.message &&
          error.cause === readFailure,
      );
    }
  } finally {
    globalThis.chrome = previousChrome;
  }

  assert.equal(writeCount, 0);
});
