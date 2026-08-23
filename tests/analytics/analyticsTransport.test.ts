import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverAnalyticsPayload,
  isAnalyticsPayload,
  resolveAnalyticsDestination,
  type AnalyticsFetch,
  type AnalyticsPayload,
} from "../../src/utils/analyticsTransport.ts";

const payload: AnalyticsPayload = {
  client_id: "test-client-id",
  events: [
    {
      name: "extension_open",
      params: {
        session_id: "123",
        engagement_time_msec: 100,
        debug_mode: true,
      },
    },
  ],
};

test("analytics message payload는 GA4의 bounded primitive contract만 허용한다", () => {
  assert.equal(isAnalyticsPayload(payload), true);
  assert.equal(
    isAnalyticsPayload({
      ...payload,
      events: [{ name: "invalid event", params: {} }],
    }),
    false,
  );
  assert.equal(
    isAnalyticsPayload({
      ...payload,
      events: [{ name: "valid_event", params: { nested: { secret: true } } }],
    }),
    false,
  );
  assert.equal(
    isAnalyticsPayload({
      ...payload,
      events: Array.from({ length: 26 }, () => payload.events[0]),
    }),
    false,
  );
});

test("first-party proxy는 client API secret을 URL에 넣지 않는다", () => {
  assert.deepEqual(
    resolveAnalyticsDestination({
      proxyUrl: "https://analytics.linku.example/collect",
      measurementId: "G-TEST",
      apiSecret: "must-not-be-forwarded",
    }),
    {
      mode: "proxy",
      url: "https://analytics.linku.example/collect",
    },
  );
});

test("proxy가 없을 때만 기존 GA Measurement Protocol direct mode를 사용한다", () => {
  const destination = resolveAnalyticsDestination({
    measurementId: "G-TEST",
    apiSecret: "test-secret",
  });

  assert.equal("url" in destination, true);
  if (!("url" in destination)) return;

  const url = new URL(destination.url);
  assert.equal(destination.mode, "direct");
  assert.equal(url.origin, "https://www.google-analytics.com");
  assert.equal(url.searchParams.get("measurement_id"), "G-TEST");
  assert.equal(url.searchParams.get("api_secret"), "test-secret");
});

test("background transport는 성공 응답과 keepalive request를 반환한다", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetchImpl: AnalyticsFetch = async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return { ok: true, status: 204 };
  };

  const result = await deliverAnalyticsPayload(
    payload,
    {
      proxyUrl: "https://analytics.linku.example/collect",
      measurementId: "G-TEST",
    },
    fetchImpl,
    true,
  );

  assert.deepEqual(result, { success: true, mode: "proxy", status: 204 });
  assert.equal(requestUrl, "https://analytics.linku.example/collect");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.keepalive, true);
  assert.equal(requestInit?.body, JSON.stringify(payload));
});

test("offline과 tracker 차단은 throw하지 않고 transport failure로 분류한다", async () => {
  const fetchImpl: AnalyticsFetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  const offline = await deliverAnalyticsPayload(
    payload,
    { measurementId: "G-TEST", apiSecret: "test-secret" },
    fetchImpl,
    false,
  );
  const blocked = await deliverAnalyticsPayload(
    payload,
    { measurementId: "G-TEST", apiSecret: "test-secret" },
    fetchImpl,
    true,
  );

  assert.deepEqual(offline, {
    success: false,
    failureKind: "offline",
    mode: "direct",
  });
  assert.deepEqual(blocked, {
    success: false,
    failureKind: "blocked_or_unreachable",
    mode: "direct",
  });
});

test("GA HTTP failure는 response body를 읽지 않고 상태만 남긴다", async () => {
  const result = await deliverAnalyticsPayload(
    payload,
    { measurementId: "G-TEST", apiSecret: "test-secret" },
    async () => ({ ok: false, status: 429 }),
    true,
  );

  assert.deepEqual(result, {
    success: false,
    failureKind: "http_error",
    mode: "direct",
    status: 429,
  });
});
