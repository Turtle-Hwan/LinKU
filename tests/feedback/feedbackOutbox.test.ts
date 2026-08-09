import assert from "node:assert/strict";
import test from "node:test";

import {
  readFeedbackOutbox,
  writeFeedbackOutbox,
} from "../../src/apis/feedbackOutbox.ts";
import type { FeedbackSubmission } from "../../src/types/feedback.ts";

const STORAGE_KEY = "linkuFeedbackOutboxV1";

const submission: FeedbackSubmission = {
  submissionId: "2e2163b0-813f-4d7d-8d21-f3b43dc68af8",
  category: "other",
  title: "문의 제목",
  message: "문의 내용",
  contactEmail: "reply@example.com",
  extensionVersion: "1.0.0",
  createdAt: "2026-08-09T00:00:00.000Z",
  website: "",
};

function createWebStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function replaceGlobal(name: "chrome" | "localStorage", value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });

  return () => {
    if (previous) {
      Object.defineProperty(globalThis, name, previous);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  };
}

test("웹에서는 localStorage outbox를 다시 읽을 수 있게 저장한다", async () => {
  const webStorage = createWebStorage();
  const restoreChrome = replaceGlobal("chrome", undefined);
  const restoreWebStorage = replaceGlobal("localStorage", webStorage);

  try {
    await writeFeedbackOutbox([submission]);
    assert.deepEqual(await readFeedbackOutbox(), [submission]);
  } finally {
    restoreWebStorage();
    restoreChrome();
  }
});

test("확장 환경에서는 chrome.storage.local을 우선한다", async () => {
  const extensionValues: Record<string, unknown> = {};
  const extensionStorage = {
    get: async (key: string) => ({ [key]: extensionValues[key] }),
    set: async (values: Record<string, unknown>) => {
      Object.assign(extensionValues, values);
    },
  };
  const webStorage = createWebStorage();
  const restoreChrome = replaceGlobal("chrome", {
    storage: { local: extensionStorage },
  });
  const restoreWebStorage = replaceGlobal("localStorage", webStorage);

  try {
    await writeFeedbackOutbox([submission]);
    assert.deepEqual(extensionValues[STORAGE_KEY], [submission]);
    assert.equal(webStorage.getItem(STORAGE_KEY), null);
    assert.deepEqual(await readFeedbackOutbox(), [submission]);
  } finally {
    restoreWebStorage();
    restoreChrome();
  }
});

test("영구 저장소가 없으면 저장 성공으로 처리하지 않는다", async () => {
  const restoreChrome = replaceGlobal("chrome", undefined);
  const restoreWebStorage = replaceGlobal("localStorage", undefined);

  try {
    await assert.rejects(
      writeFeedbackOutbox([submission]),
      /FEEDBACK_OUTBOX_STORAGE_UNAVAILABLE/,
    );
  } finally {
    restoreWebStorage();
    restoreChrome();
  }
});
