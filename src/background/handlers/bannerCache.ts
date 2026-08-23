/// <reference lib="webworker" />

import {
  BANNER_BASE_URL,
  BANNER_JSON_URL,
  getBannerImageURL,
  parseBannersResponse,
} from "../../apis/external/banners.ts";

const BANNER_CACHE_PREFIX = "linku-banners-v1-";
const BANNER_CACHE_STATE_KEY = "linkuBannerCacheStateV1";
export const BANNER_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface BannerCacheState {
  activeCacheName?: string;
  nextCheckAt: number;
}

interface BannerResponseCache {
  match(request: RequestInfo | URL): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
}

interface BannerCacheStorage {
  open(cacheName: string): Promise<BannerResponseCache>;
  keys(): Promise<string[]>;
  delete(cacheName: string): Promise<boolean>;
}

interface BannerStateStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

interface BannerCacheDependencies {
  cacheStorage: BannerCacheStorage;
  stateStorage: BannerStateStorage;
  fetchFn: typeof fetch;
  now: () => number;
  createCacheName: (now: number) => string;
  onError: (error: unknown) => void;
}

interface BannerFetchEvent extends Event {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
  waitUntil(promise: Promise<unknown>): void;
}

interface BannerServiceWorkerScope {
  addEventListener(
    type: "fetch",
    listener: (event: BannerFetchEvent) => void,
  ): void;
}

const isBannerCacheState = (value: unknown): value is BannerCacheState => {
  if (!value || typeof value !== "object") return false;

  const state = value as Partial<BannerCacheState>;
  return (
    typeof state.nextCheckAt === "number" &&
    Number.isFinite(state.nextCheckAt) &&
    (state.activeCacheName === undefined ||
      (typeof state.activeCacheName === "string" &&
        state.activeCacheName.startsWith(BANNER_CACHE_PREFIX)))
  );
};

const createEmptyBannerResponse = () =>
  new Response(JSON.stringify({ banners: [] }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const isBannerImageResponse = (response: Response) =>
  response.ok &&
  response.headers.get("content-type")?.startsWith("image/") === true;

export const isBannerRequest = (request: Request) => {
  if (request.method !== "GET") return false;

  const requestURL = new URL(request.url);
  const baseURL = new URL(BANNER_BASE_URL);
  return (
    requestURL.origin === baseURL.origin &&
    requestURL.pathname.startsWith(baseURL.pathname)
  );
};

export const createBannerCacheController = (
  dependencies: BannerCacheDependencies,
) => {
  const {
    cacheStorage,
    stateStorage,
    fetchFn,
    now,
    createCacheName,
    onError,
  } = dependencies;
  let activeRefresh: Promise<BannerCacheState> | undefined;

  const readState = async (): Promise<BannerCacheState> => {
    const stored = await stateStorage.get(BANNER_CACHE_STATE_KEY);
    const value: unknown = stored[BANNER_CACHE_STATE_KEY];
    return isBannerCacheState(value) ? value : { nextCheckAt: 0 };
  };

  const writeState = (state: BannerCacheState) =>
    stateStorage.set({ [BANNER_CACHE_STATE_KEY]: state });

  const matchActiveCache = async (
    state: BannerCacheState,
    request: Request | string,
  ) => {
    if (!state.activeCacheName) return undefined;
    return (await cacheStorage.open(state.activeCacheName)).match(request);
  };

  const removeObsoleteCaches = async (
    activeCacheName: string,
    previousCacheName?: string,
  ) => {
    const cacheNames = await cacheStorage.keys();
    await Promise.all(
      cacheNames
        .filter(
          (cacheName) =>
            cacheName.startsWith(BANNER_CACHE_PREFIX) &&
            cacheName !== activeCacheName &&
            cacheName !== previousCacheName,
        )
        .map((cacheName) => cacheStorage.delete(cacheName)),
    );
  };

  const performRefresh = async (
    currentState: BannerCacheState,
    checkedAt: number,
  ): Promise<BannerCacheState> => {
    const nextCacheName = createCacheName(checkedAt);
    const nextCheckAt = checkedAt + BANNER_REFRESH_INTERVAL_MS;

    try {
      const bannerResponse = await fetchFn(BANNER_JSON_URL, {
        cache: "no-store",
        credentials: "omit",
      });
      if (!bannerResponse.ok) {
        throw new Error(`Failed to refresh banners: ${bannerResponse.status}`);
      }

      const responseForCache = bannerResponse.clone();
      const data: unknown = await bannerResponse.json();
      const { banners } = parseBannersResponse(data);
      const imageURLs = [
        ...new Set(banners.map(({ img }) => getBannerImageURL(img))),
      ];
      const imageResponses = await Promise.all(
        imageURLs.map(async (imageURL) => {
          const response = await fetchFn(imageURL, {
            cache: "no-store",
            credentials: "omit",
          });
          if (!isBannerImageResponse(response)) {
            throw new Error(`Failed to refresh banner image: ${imageURL}`);
          }
          return [imageURL, response] as const;
        }),
      );

      const nextCache = await cacheStorage.open(nextCacheName);
      await Promise.all(
        imageResponses.map(([imageURL, response]) =>
          nextCache.put(imageURL, response),
        ),
      );
      await nextCache.put(BANNER_JSON_URL, responseForCache);

      const nextState: BannerCacheState = {
        activeCacheName: nextCacheName,
        nextCheckAt,
      };
      await writeState(nextState);

      await removeObsoleteCaches(
        nextCacheName,
        currentState.activeCacheName,
      ).catch(onError);
      return nextState;
    } catch (error) {
      await cacheStorage.delete(nextCacheName).catch(onError);
      await writeState({ ...currentState, nextCheckAt }).catch(onError);
      throw error;
    }
  };

  const refresh = (checkedAt: number) => {
    if (activeRefresh) return activeRefresh;

    const refreshPromise = readState()
      .then((latestState) =>
        checkedAt < latestState.nextCheckAt
          ? latestState
          : performRefresh(latestState, checkedAt),
      )
      .finally(() => {
        if (activeRefresh === refreshPromise) {
          activeRefresh = undefined;
        }
      });
    activeRefresh = refreshPromise;
    return refreshPromise;
  };

  const getResponse = async (
    request: Request,
  ): Promise<{
    response: Response;
    backgroundTask?: Promise<void>;
  }> => {
    try {
      const checkedAt = now();
      const state = await readState();
      const cachedResponse = await matchActiveCache(state, request);

      if (cachedResponse) {
        if (
          request.url === BANNER_JSON_URL &&
          checkedAt >= state.nextCheckAt
        ) {
          return {
            response: cachedResponse,
            backgroundTask: refresh(checkedAt)
              .then(() => undefined)
              .catch(onError),
          };
        }
        return { response: cachedResponse };
      }

      if (request.url !== BANNER_JSON_URL) {
        return { response: await fetchFn(request) };
      }

      if (checkedAt < state.nextCheckAt) {
        return { response: createEmptyBannerResponse() };
      }

      try {
        const nextState = await refresh(checkedAt);
        return {
          response:
            (await matchActiveCache(nextState, request)) ??
            createEmptyBannerResponse(),
        };
      } catch (error) {
        onError(error);
        return { response: createEmptyBannerResponse() };
      }
    } catch (error) {
      onError(error);
      if (request.url === BANNER_JSON_URL) {
        return { response: createEmptyBannerResponse() };
      }
      return { response: await fetchFn(request) };
    }
  };

  return { getResponse };
};

export const registerBannerCache = (onError: (error: unknown) => void) => {
  const controller = createBannerCacheController({
    cacheStorage: caches,
    stateStorage: chrome.storage.local,
    fetchFn: fetch.bind(globalThis),
    now: Date.now,
    createCacheName: (now) =>
      `${BANNER_CACHE_PREFIX}${now}-${crypto.randomUUID()}`,
    onError,
  });
  const scope = globalThis as unknown as BannerServiceWorkerScope;

  scope.addEventListener("fetch", (event) => {
    if (!isBannerRequest(event.request)) return;
    const resultPromise = controller.getResponse(event.request);
    event.respondWith(resultPromise.then(({ response }) => response));
    event.waitUntil(
      resultPromise.then(({ backgroundTask }) => backgroundTask),
    );
  });
};
