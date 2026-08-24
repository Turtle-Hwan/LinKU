import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createServer, type ViteDevServer } from "vite";

import type { FeedbackSubmission } from "../../src/types/feedback.ts";

const STORAGE_KEY = "linkuFeedbackOutboxV1";
const TEST_ENDPOINT =
  "https://script.google.com/macros/s/test-deployment/exec";

const submissions: FeedbackSubmission[] = [0, 1, 2].map((index) => ({
  submissionId: `2e2163b0-813f-4d7d-8d21-f3b43dc68a0${index}`,
  category: "other",
  title: `문의 제목 ${index}`,
  message: `문의 내용 ${index}`,
  contactEmail: "reply@example.com",
  extensionVersion: "1.0.0",
  createdAt: "2026-08-09T00:00:00.000Z",
  website: "",
}));

function replaceGlobal(name: string, value: unknown) {
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

let server: ViteDevServer;
let flushFeedbackOutbox: () => Promise<void>;
let restoreChrome: () => void;
let restoreFetch: () => void;
let restoreWindow: () => void;
let fetchCount = 0;
const extensionValues: Record<string, unknown> = {};
const previousEndpoint = process.env.VITE_VOC_ENDPOINT;

before(async () => {
  process.env.VITE_VOC_ENDPOINT = TEST_ENDPOINT;
  restoreChrome = replaceGlobal("chrome", {
    runtime: { getManifest: () => ({ version: "1.0.0" }) },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: extensionValues[key] }),
        set: async (values: Record<string, unknown>) => {
          Object.assign(extensionValues, values);
        },
      },
    },
  });
  restoreWindow = replaceGlobal("window", globalThis);
  restoreFetch = replaceGlobal("fetch", async () => {
    fetchCount += 1;
    throw new TypeError("Failed to fetch");
  });

  server = await createServer({
    appType: "custom",
    logLevel: "silent",
    mode: "development",
    server: { middlewareMode: true },
  });
  const feedbackModule = await server.ssrLoadModule("/src/apis/feedback.ts");
  flushFeedbackOutbox = feedbackModule.flushFeedbackOutbox;
});

after(async () => {
  await server.close();
  restoreFetch();
  restoreWindow();
  restoreChrome();
  if (previousEndpoint === undefined) {
    delete process.env.VITE_VOC_ENDPOINT;
  } else {
    process.env.VITE_VOC_ENDPOINT = previousEndpoint;
  }
});

test("outbox flush stops after the first endpoint-wide transport failure", async () => {
  extensionValues[STORAGE_KEY] = submissions;

  await flushFeedbackOutbox();

  assert.equal(fetchCount, 1);
  assert.deepEqual(extensionValues[STORAGE_KEY], submissions);
});
