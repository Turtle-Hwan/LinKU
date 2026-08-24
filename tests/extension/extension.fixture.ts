import path from "node:path";
import process from "node:process";

import {
  chromium,
  test as base,
  type BrowserContext,
  type Worker,
} from "@playwright/test";

const EXTENSION_PATH = path.resolve("dist");
const BACKGROUND_PATH = "/background/index.js";

export interface ExtensionRuntime {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  popupUrl: string;
}

const isBackgroundWorker = (worker: Worker) => {
  try {
    return new URL(worker.url()).pathname === BACKGROUND_PATH;
  } catch {
    return false;
  }
};

const waitForBackgroundWorker = async (context: BrowserContext) => {
  const existing = context.serviceWorkers().find(isBackgroundWorker);
  return (
    existing ??
    context.waitForEvent("serviceworker", {
      predicate: isBackgroundWorker,
    })
  );
};

export const test = base.extend<{ extension: ExtensionRuntime }>({
  extension: async ({ browserName }, provide) => {
    if (browserName !== "chromium") {
      throw new Error("MV3 extension tests require Playwright Chromium.");
    }

    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: process.env.LINKU_E2E_HEADED !== "1",
      viewport: { width: 500, height: 600 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    try {
      const worker = await waitForBackgroundWorker(context);
      const extensionId = new URL(worker.url()).host;
      await provide({
        context,
        worker,
        extensionId,
        popupUrl: `chrome-extension://${extensionId}/index.html`,
      });
    } finally {
      await context.close();
    }
  },
});

export { expect } from "@playwright/test";
