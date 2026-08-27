import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverAnalyticsPayload,
  resolveAnalyticsUrl,
  type AnalyticsFetch,
} from "../../src/utils/analyticsTransport.ts";
import {
  isAnalyticsPayload,
  type AnalyticsPayload,
} from "../../src/utils/analyticsContract.ts";

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

test("transport 미설정 시 네트워크 요청 없이 수집을 건너뛴다", async () => {
  let fetchCalled = false;
  const result = await deliverAnalyticsPayload(
    payload,
    { measurementId: "G-TEST" },
    async () => {
      fetchCalled = true;
      return { ok: true, status: 204 };
    },
    true,
  );

  assert.deepEqual(result, {
    success: false,
    failureKind: "unconfigured",
  });
  assert.equal(fetchCalled, false);
});

test("GA Measurement Protocol direct URL에 release secret을 사용한다", () => {
  const destination = resolveAnalyticsUrl({
    measurementId: "G-TEST",
    apiSecret: "test-secret",
  });

  assert.equal(typeof destination, "string");
  if (typeof destination !== "string") return;

  const url = new URL(destination);
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
      measurementId: "G-TEST",
      apiSecret: "test-secret",
    },
    fetchImpl,
    true,
  );

  assert.deepEqual(result, { success: true, status: 204 });
  const url = new URL(requestUrl);
  assert.equal(url.origin, "https://www.google-analytics.com");
  assert.equal(url.searchParams.get("measurement_id"), "G-TEST");
  assert.equal(url.searchParams.get("api_secret"), "test-secret");
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
  });
  assert.deepEqual(blocked, {
    success: false,
    failureKind: "blocked_or_unreachable",
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
    status: 429,
  });
});
