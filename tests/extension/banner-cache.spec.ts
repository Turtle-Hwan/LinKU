import path from "node:path";
import process from "node:process";

import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";

import {
  BANNER_JSON_URL,
  getBannerImageURL,
} from "../../src/apis/external/banners.ts";
import { BANNER_REFRESH_INTERVAL_MS } from "../../src/background/handlers/bannerCache.ts";

const EXTENSION_PATH = path.resolve("dist");
const BACKGROUND_PATH = "/background/index.js";
const CACHE_STATE_KEY = "linkuBannerCacheStateV1";
const CACHE_NAME = "linku-banners-v1-e2e";
const BANNER_IMAGE_PATH = "e2e-banner.svg";
const BANNER_IMAGE_URL = getBannerImageURL(BANNER_IMAGE_PATH);
const BANNER_ALT = "E2E 캐시 배너";
const BANNER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="500" height="85" viewBox="0 0 500 85">
    <rect width="500" height="85" rx="8" fill="#166534" />
    <text x="250" y="49" fill="white" font-family="sans-serif" font-size="20" text-anchor="middle">
      LinKU offline cache
    </text>
  </svg>
`;

interface BannerCacheState {
  activeCacheName?: string;
  nextCheckAt: number;
}

const isBackgroundWorker = (worker: Worker) => {
  try {
    return new URL(worker.url()).pathname === BACKGROUND_PATH;
  } catch {
    return false;
  }
};

const getBackgroundWorker = async (context: BrowserContext) => {
  const existing = context.serviceWorkers().find(isBackgroundWorker);
  return (
    existing ??
    context.waitForEvent("serviceworker", {
      predicate: isBackgroundWorker,
    })
  );
};

const seedExpiredBannerCache = async (worker: Worker) => {
  await worker.evaluate(
    async ({
      bannerAlt,
      bannerImagePath,
      bannerImageURL,
      bannerJsonURL,
      bannerSVG,
      cacheName,
      cacheStateKey,
    }) => {
      const bannerCacheNames = (await caches.keys()).filter((name) =>
        name.startsWith("linku-banners-v1-"),
      );
      await Promise.all(bannerCacheNames.map((name) => caches.delete(name)));

      const cache = await caches.open(cacheName);
      await cache.put(
        bannerImageURL,
        new Response(bannerSVG, {
          headers: { "content-type": "image/svg+xml; charset=utf-8" },
        }),
      );
      await cache.put(
        bannerJsonURL,
        new Response(
          JSON.stringify({
            banners: [
              {
                img: bannerImagePath,
                alt: bannerAlt,
                link: "https://example.com/e2e-banner",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      );
      await chrome.storage.local.set({
        [cacheStateKey]: {
          activeCacheName: cacheName,
          nextCheckAt: 0,
        },
      });
    },
    {
      bannerAlt: BANNER_ALT,
      bannerImagePath: BANNER_IMAGE_PATH,
      bannerImageURL: BANNER_IMAGE_URL,
      bannerJsonURL: BANNER_JSON_URL,
      bannerSVG: BANNER_SVG,
      cacheName: CACHE_NAME,
      cacheStateKey: CACHE_STATE_KEY,
    },
  );
};

const openExtensionSurface = async (
  context: BrowserContext,
  worker: Worker,
  extensionId: string,
) => {
  const hostPage = context.pages()[0] ?? (await context.newPage());
  const popupURL = `chrome-extension://${extensionId}/index.html`;
  const popup = await context.newPage();
  await popup.goto(popupURL);

  // Chromium creates an action-popup target, but Playwright does not expose
  // that native surface as a Page. Verify the target through CDP and inspect
  // the same extension document through its chrome-extension:// URL.
  await hostPage.bringToFront();
  const cdpSession = await context.newCDPSession(hostPage);
  const { targetInfos: targetsBeforeAction } = await cdpSession.send(
    "Target.getTargets",
  );
  const targetIdsBeforeAction = new Set(
    targetsBeforeAction.map(({ targetId }) => targetId),
  );
  await worker.evaluate(async () => {
    await chrome.action.openPopup();
  });

  let actionPopupTarget:
    | { targetId: string; type: string; url: string }
    | undefined;
  try {
    await expect
      .poll(async () => {
        const { targetInfos } = await cdpSession.send("Target.getTargets");
        actionPopupTarget = targetInfos.find(
          ({ targetId, url }) =>
            !targetIdsBeforeAction.has(targetId) && url.startsWith(popupURL),
        );
        return actionPopupTarget !== undefined;
      })
      .toBe(true);
  } finally {
    await cdpSession.detach();
  }

  return { actionPopupTarget, popup };
};

const readBannerCacheState = (worker: Worker) =>
  worker.evaluate(
    async (cacheStateKey): Promise<BannerCacheState | undefined> => {
      const stored = await chrome.storage.local.get(cacheStateKey);
      return stored[cacheStateKey] as BannerCacheState | undefined;
    },
    CACHE_STATE_KEY,
  );

const attachRuntimeErrorCollector = (
  context: BrowserContext,
  pageErrors: string[],
  consoleErrors: string[],
) => {
  const attachPage = (page: Page) => {
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
  };

  context.pages().forEach(attachPage);
  context.on("page", attachPage);
};

test(
  "만료된 배너 캐시를 실제 MV3 popup에서 즉시 보여주고 오프라인 갱신 실패에도 유지한다",
  async ({ browserName }, testInfo) => {
    test.setTimeout(60_000);
    expect(browserName).toBe("chromium");

    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: process.env.LINKU_E2E_HEADED !== "1",
      viewport: { width: 500, height: 600 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    attachRuntimeErrorCollector(context, pageErrors, consoleErrors);

    try {
      const worker = await getBackgroundWorker(context);
      const extensionId = new URL(worker.url()).host;
      await seedExpiredBannerCache(worker);

      const refreshStartedAt = Date.now();
      await context.setOffline(true);
      const { actionPopupTarget, popup } = await openExtensionSurface(
        context,
        worker,
        extensionId,
      );

      expect(actionPopupTarget?.url).toMatch(
        new RegExp(`^chrome-extension://${extensionId}/index\\.html`),
      );
      expect(["other", "page"]).toContain(actionPopupTarget?.type);
      await expect(popup).toHaveTitle("LinKU");
      await expect(popup.getByPlaceholder("검색어 입력")).toBeVisible();

      const banner = popup.getByRole("img", { name: BANNER_ALT });
      await expect(banner).toBeVisible();
      await expect
        .poll(() =>
          banner.evaluate((image: HTMLImageElement) => ({
            complete: image.complete,
            naturalWidth: image.naturalWidth,
          })),
        )
        .toEqual({ complete: true, naturalWidth: 500 });
      await expect(popup.locator(".animate-pulse")).toHaveCount(0);
      expect(popup.viewportSize()).toEqual({ width: 500, height: 600 });

      const popupSize = await popup
        .locator("#root > div")
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
      expect(popupSize).toEqual({ width: 500, height: 600 });

      await expect
        .poll(async () =>
          (await readBannerCacheState(worker))?.nextCheckAt ?? 0,
        )
        .toBeGreaterThanOrEqual(
          refreshStartedAt + BANNER_REFRESH_INTERVAL_MS,
        );
      const state = await readBannerCacheState(worker);
      expect(state?.activeCacheName).toBe(CACHE_NAME);
      expect(state?.nextCheckAt).toBeLessThanOrEqual(
        Date.now() + BANNER_REFRESH_INTERVAL_MS,
      );
      await expect
        .poll(() => worker.evaluate(() => caches.keys()))
        .toEqual([CACHE_NAME]);

      await testInfo.attach("mv3-popup-offline-banner", {
        body: await popup.screenshot(),
        contentType: "image/png",
      });

      expect(pageErrors).toEqual([]);
      expect(
        consoleErrors.filter(
          (message) =>
            // The whole context is deliberately offline. These are unrelated,
            // handled network failures from the font preload and todo badge.
            !message.includes("net::ERR_INTERNET_DISCONNECTED") &&
            !message.startsWith("Failed to fetch todo list:"),
        ),
      ).toEqual([]);
    } finally {
      await context.close();
    }
  },
);
