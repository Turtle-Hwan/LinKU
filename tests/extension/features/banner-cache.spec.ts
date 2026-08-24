import type { Worker } from "@playwright/test";

import {
  BANNER_JSON_URL,
  getBannerImageURL,
} from "../../../src/apis/external/banners.ts";
import { BANNER_REFRESH_INTERVAL_MS } from "../../../src/background/handlers/bannerCache.ts";
import { expect, test } from "../extension.fixture.ts";

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

const readBannerCacheState = (worker: Worker) =>
  worker.evaluate(
    async (cacheStateKey): Promise<BannerCacheState | undefined> => {
      const stored = await chrome.storage.local.get(cacheStateKey);
      return stored[cacheStateKey] as BannerCacheState | undefined;
    },
    CACHE_STATE_KEY,
  );

test(
  "만료된 배너 캐시를 즉시 보여주고 오프라인 갱신 실패에도 유지한다",
  async ({ extension }, testInfo) => {
    test.setTimeout(60_000);

    const { context, worker, popupUrl } = extension;
    await seedExpiredBannerCache(worker);

    const refreshStartedAt = Date.now();
    await context.setOffline(true);
    const popup = await context.newPage();
    const pageErrors: string[] = [];
    popup.on("pageerror", (error) => pageErrors.push(error.message));
    await popup.goto(popupUrl);

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

    await expect
      .poll(async () => (await readBannerCacheState(worker))?.nextCheckAt ?? 0)
      .toBeGreaterThanOrEqual(refreshStartedAt + BANNER_REFRESH_INTERVAL_MS);
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
  },
);
