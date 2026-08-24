import assert from "node:assert/strict";
import test from "node:test";

import {
  BANNER_BASE_URL,
  BANNER_JSON_URL,
  getBannerImageURL,
  parseBannersResponse,
} from "../../src/apis/external/banners.ts";
import {
  BANNER_REFRESH_INTERVAL_MS,
  createBannerCacheController,
  isBannerRequest,
  registerBannerCache,
} from "../../src/background/handlers/bannerCache.ts";

const CACHE_STATE_KEY = "linkuBannerCacheStateV1";
const OLD_CACHE_NAME = "linku-banners-v1-old";
const NEW_CACHE_NAME = "linku-banners-v1-new";
const NOW = Date.parse("2026-08-22T00:00:00Z");

const oldPayload = {
  banners: [
    {
      img: "old.png",
      alt: "기존 배너",
      link: "https://example.com/old",
    },
  ],
};

const newPayload = {
  banners: [
    {
      img: "new.png",
      alt: "새 배너",
      link: "https://example.com/new",
    },
  ],
};

const toRequestURL = (request: RequestInfo | URL) => {
  if (request instanceof Request) return request.url;
  return request.toString();
};

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const imageResponse = (status = 200, contentType = "image/png") =>
  new Response(new Uint8Array([1, 2, 3]), {
    status,
    headers: { "content-type": contentType },
  });

class MemoryCache {
  readonly entries = new Map<string, Response>();
  readonly putOrder: string[] = [];

  async match(request: RequestInfo | URL) {
    return this.entries.get(toRequestURL(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response) {
    const requestURL = toRequestURL(request);
    this.putOrder.push(requestURL);
    this.entries.set(requestURL, response.clone());
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>();

  async open(cacheName: string) {
    let cache = this.stores.get(cacheName);
    if (!cache) {
      cache = new MemoryCache();
      this.stores.set(cacheName, cache);
    }
    return cache;
  }

  async keys() {
    return [...this.stores.keys()];
  }

  async delete(cacheName: string) {
    return this.stores.delete(cacheName);
  }
}

const createStateStorage = (initial: Record<string, unknown>) => {
  const values = { ...initial };
  const storage = {
    get: async (key: string) => ({ [key]: values[key] }),
    set: async (entries: Record<string, unknown>) => {
      Object.assign(values, entries);
    },
  };

  return { storage, values };
};

const replaceGlobal = (name: string, value: unknown) => {
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
};

const createController = ({
  cacheStorage,
  stateStorage,
  fetchFn,
  errors,
  createCacheName = () => NEW_CACHE_NAME,
}: {
  cacheStorage: MemoryCacheStorage;
  stateStorage: ReturnType<typeof createStateStorage>["storage"];
  fetchFn: typeof fetch;
  errors: unknown[];
  createCacheName?: (now: number) => string;
}) =>
  createBannerCacheController({
    cacheStorage,
    stateStorage,
    fetchFn,
    now: () => NOW,
    createCacheName,
    onError: (error) => errors.push(error),
  });

const createGate = () => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

test("배너 응답과 이미지 경로를 unknown에서 검증한다", () => {
  assert.deepEqual(parseBannersResponse(oldPayload), oldPayload);
  assert.throws(
    () => parseBannersResponse({ banners: [{ img: "broken.png" }] }),
    /Invalid banner response/,
  );
  assert.equal(
    getBannerImageURL("old.png"),
    new URL("old.png", BANNER_BASE_URL).toString(),
  );
  assert.throws(() => getBannerImageURL("../outside.png"));
});

test("배너 GET 요청만 서비스 워커 캐시 대상으로 삼는다", () => {
  assert.equal(isBannerRequest(new Request(BANNER_JSON_URL)), true);
  assert.equal(
    isBannerRequest(new Request(BANNER_JSON_URL, { method: "POST" })),
    false,
  );
  assert.equal(
    isBannerRequest(new Request("https://example.com/banner.json")),
    false,
  );
});

test("24시간 이내에는 캐시를 즉시 반환하고 네트워크를 호출하지 않는다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const oldCache = (await cacheStorage.open(OLD_CACHE_NAME)) as unknown as MemoryCache;
  await oldCache.put(BANNER_JSON_URL, jsonResponse(oldPayload));
  const { storage } = createStateStorage({
    [CACHE_STATE_KEY]: {
      activeCacheName: OLD_CACHE_NAME,
      nextCheckAt: NOW + 1,
    },
  });
  let fetchCalls = 0;
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async () => {
      fetchCalls += 1;
      throw new Error("network should not be used");
    }) as typeof fetch,
    errors: [],
  });

  const result = await controller.getResponse(new Request(BANNER_JSON_URL));

  assert.deepEqual(await result.response.json(), oldPayload);
  assert.equal(fetchCalls, 0);
  assert.equal(result.backgroundTask, undefined);
});

test("만료된 캐시는 먼저 반환하고 완성된 새 스냅샷을 다음 요청에 사용한다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const oldCache = (await cacheStorage.open(OLD_CACHE_NAME)) as unknown as MemoryCache;
  await oldCache.put(BANNER_JSON_URL, jsonResponse(oldPayload));
  const { storage, values } = createStateStorage({
    [CACHE_STATE_KEY]: {
      activeCacheName: OLD_CACHE_NAME,
      nextCheckAt: NOW - 1,
    },
  });
  const fetchCalls: string[] = [];
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async (request) => {
      const requestURL = toRequestURL(request);
      fetchCalls.push(requestURL);
      return requestURL === BANNER_JSON_URL
        ? jsonResponse(newPayload)
        : imageResponse();
    }) as typeof fetch,
    errors: [],
  });

  const currentResult = await controller.getResponse(
    new Request(BANNER_JSON_URL),
  );

  assert.deepEqual(await currentResult.response.json(), oldPayload);
  assert.ok(currentResult.backgroundTask);
  await currentResult.backgroundTask;

  assert.deepEqual(values[CACHE_STATE_KEY], {
    activeCacheName: NEW_CACHE_NAME,
    nextCheckAt: NOW + BANNER_REFRESH_INTERVAL_MS,
  });
  assert.deepEqual(fetchCalls, [
    BANNER_JSON_URL,
    getBannerImageURL("new.png"),
  ]);

  const newCache = cacheStorage.stores.get(NEW_CACHE_NAME);
  assert.ok(newCache);
  assert.equal(newCache.putOrder.at(-1), BANNER_JSON_URL);

  const nextResult = await controller.getResponse(
    new Request(BANNER_JSON_URL),
  );
  assert.deepEqual(await nextResult.response.json(), newPayload);
  assert.equal(nextResult.backgroundTask, undefined);
});

test("오래된 state를 읽은 요청이 완료된 갱신을 다시 실행하지 않는다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const oldCache = (await cacheStorage.open(OLD_CACHE_NAME)) as unknown as MemoryCache;
  await oldCache.put(BANNER_JSON_URL, jsonResponse(oldPayload));
  const { storage, values } = createStateStorage({
    [CACHE_STATE_KEY]: {
      activeCacheName: OLD_CACHE_NAME,
      nextCheckAt: NOW - 1,
    },
  });
  const firstFetchStarted = createGate();
  const releaseFirstFetch = createGate();
  const secondMatchStarted = createGate();
  const releaseSecondMatch = createGate();
  const originalMatch = oldCache.match.bind(oldCache);
  let oldCacheMatchCalls = 0;
  oldCache.match = async (request) => {
    oldCacheMatchCalls += 1;
    if (oldCacheMatchCalls === 2) {
      secondMatchStarted.release();
      await releaseSecondMatch.promise;
    }
    return originalMatch(request);
  };

  let bannerFetchCalls = 0;
  let cacheSequence = 0;
  const errors: unknown[] = [];
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async (request) => {
      const requestURL = toRequestURL(request);
      if (requestURL !== BANNER_JSON_URL) return imageResponse();

      bannerFetchCalls += 1;
      if (bannerFetchCalls > 1) {
        throw new Error("a completed refresh must not run again");
      }
      firstFetchStarted.release();
      await releaseFirstFetch.promise;
      return jsonResponse(newPayload);
    }) as typeof fetch,
    createCacheName: () => `${NEW_CACHE_NAME}-${++cacheSequence}`,
    errors,
  });

  const firstResult = await controller.getResponse(
    new Request(BANNER_JSON_URL),
  );
  assert.ok(firstResult.backgroundTask);
  await firstFetchStarted.promise;

  const secondResultPromise = controller.getResponse(
    new Request(BANNER_JSON_URL),
  );
  await secondMatchStarted.promise;

  releaseFirstFetch.release();
  await firstResult.backgroundTask;
  releaseSecondMatch.release();

  const secondResult = await secondResultPromise;
  assert.ok(secondResult.backgroundTask);
  await secondResult.backgroundTask;

  assert.equal(bannerFetchCalls, 1);
  assert.equal(cacheSequence, 1);
  assert.deepEqual(values[CACHE_STATE_KEY], {
    activeCacheName: `${NEW_CACHE_NAME}-1`,
    nextCheckAt: NOW + BANNER_REFRESH_INTERVAL_MS,
  });
  assert.deepEqual(errors, []);
});

test("외부 이미지 응답 실패 시 이슈 없이 기존 스냅샷을 유지한다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const oldCache = (await cacheStorage.open(OLD_CACHE_NAME)) as unknown as MemoryCache;
  await oldCache.put(BANNER_JSON_URL, jsonResponse(oldPayload));
  const { storage, values } = createStateStorage({
    [CACHE_STATE_KEY]: {
      activeCacheName: OLD_CACHE_NAME,
      nextCheckAt: NOW - 1,
    },
  });
  const errors: unknown[] = [];
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async (request) =>
      toRequestURL(request) === BANNER_JSON_URL
        ? jsonResponse(newPayload)
        : imageResponse(200, "text/html")) as typeof fetch,
    errors,
  });

  const result = await controller.getResponse(
    new Request(BANNER_JSON_URL),
  );
  assert.deepEqual(await result.response.json(), oldPayload);
  assert.ok(result.backgroundTask);
  await result.backgroundTask;

  assert.deepEqual(values[CACHE_STATE_KEY], {
    activeCacheName: OLD_CACHE_NAME,
    nextCheckAt: NOW + BANNER_REFRESH_INTERVAL_MS,
  });
  assert.deepEqual(await cacheStorage.keys(), [OLD_CACHE_NAME]);
  assert.deepEqual(errors, []);
});

test("최초 외부 HTTP 실패는 이슈 없이 빈 목록 fallback을 유지한다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { storage, values } = createStateStorage({});
  const errors: unknown[] = [];
  let fetchCalls = 0;
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async () => {
      fetchCalls += 1;
      return jsonResponse({}, 503);
    }) as typeof fetch,
    errors,
  });

  const firstResult = await controller.getResponse(
    new Request(BANNER_JSON_URL),
  );
  const secondResult = await controller.getResponse(
    new Request(BANNER_JSON_URL),
  );

  assert.deepEqual(await firstResult.response.json(), { banners: [] });
  assert.deepEqual(await secondResult.response.json(), { banners: [] });
  assert.equal(fetchCalls, 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(values[CACHE_STATE_KEY], {
    nextCheckAt: NOW + BANNER_REFRESH_INTERVAL_MS,
  });
});

test("배너 전송 실패도 이슈를 만들지 않고 빈 목록 fallback을 반환한다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { storage } = createStateStorage({});
  const errors: unknown[] = [];
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch,
    errors,
  });

  const result = await controller.getResponse(new Request(BANNER_JSON_URL));

  assert.deepEqual(await result.response.json(), { banners: [] });
  assert.deepEqual(errors, []);
});

test("게시된 배너 JSON 스키마 오류는 예상 외 오류로 보고하고 빈 목록을 반환한다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { storage } = createStateStorage({});
  const errors: unknown[] = [];
  const controller = createController({
    cacheStorage,
    stateStorage: storage,
    fetchFn: (async () =>
      jsonResponse({ banners: [{ img: "broken.png" }] })) as typeof fetch,
    errors,
  });

  const result = await controller.getResponse(new Request(BANNER_JSON_URL));

  assert.deepEqual(await result.response.json(), { banners: [] });
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /Invalid banner response/u);
});

test("fetch 이벤트 수명 연장을 비동기 캐시 조회 전에 등록한다", async () => {
  const cacheStorage = new MemoryCacheStorage();
  const oldCache = (await cacheStorage.open(OLD_CACHE_NAME)) as unknown as MemoryCache;
  await oldCache.put(BANNER_JSON_URL, jsonResponse(oldPayload));
  const { storage } = createStateStorage({
    [CACHE_STATE_KEY]: {
      activeCacheName: OLD_CACHE_NAME,
      nextCheckAt: NOW + BANNER_REFRESH_INTERVAL_MS,
    },
  });
  let fetchListener: ((event: unknown) => void) | undefined;
  const restoreCaches = replaceGlobal("caches", cacheStorage);
  const restoreChrome = replaceGlobal("chrome", {
    storage: { local: storage },
  });
  const restoreAddEventListener = replaceGlobal(
    "addEventListener",
    (type: string, listener: (event: unknown) => void) => {
      if (type === "fetch") fetchListener = listener;
    },
  );

  try {
    registerBannerCache(() => assert.fail("fresh cache must not fail"));
    assert.ok(fetchListener);

    let responsePromise: Promise<Response> | undefined;
    let lifetimePromise: Promise<unknown> | undefined;
    fetchListener({
      request: new Request(BANNER_JSON_URL),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
      waitUntil: (promise: Promise<unknown>) => {
        lifetimePromise = promise;
      },
    });

    assert.ok(responsePromise);
    assert.ok(lifetimePromise);
    assert.deepEqual(await (await responsePromise).json(), oldPayload);
    await lifetimePromise;
  } finally {
    restoreAddEventListener();
    restoreChrome();
    restoreCaches();
  }
});
