import assert from "node:assert/strict";
import test from "node:test";

import {
  getLibrarySeatRoomsAPI,
  loadLibrarySeatRoomsAPI,
  type LibrarySeatRoomsSessionDependencies,
} from "../../src/apis/external/library.ts";
import type { LibraryLoginData } from "../../src/types/api.ts";
import {
  capturedErrors,
  consoleWarnings,
  resetRuntimeStubs,
} from "../helpers/runtimeStubs.ts";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

test("좌석 API는 인증과 서버 장애를 구분하고 needLogin은 인증에만 설정한다", async (t) => {
  resetRuntimeStubs();
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));

  const authFailure = await getLibrarySeatRoomsAPI("rejected-token");
  assert.equal(authFailure.success, false);
  if (authFailure.success) assert.fail("expected auth failure");
  assert.equal(authFailure.failureKind, "auth");
  assert.equal(authFailure.needLogin, true);
  assert.deepEqual(capturedErrors, []);

  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  const outage = await getLibrarySeatRoomsAPI("valid-token");
  assert.equal(outage.success, false);
  if (outage.success) assert.fail("expected HTTP failure");
  assert.equal(outage.failureKind, "http");
  assert.equal(outage.needLogin, undefined);
  assert.deepEqual(capturedErrors, []);
});

test("전송 실패와 timeout은 예상 가능한 상태로 반환하고 이슈를 만들지 않는다", async (t) => {
  resetRuntimeStubs();
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });

  const transport = await getLibrarySeatRoomsAPI("token");
  assert.equal(transport.success, false);
  if (transport.success) assert.fail("expected transport failure");
  assert.equal(transport.failureKind, "transport");
  assert.equal(transport.needLogin, undefined);

  globalThis.fetch = (async (_input, init) => {
    assert.ok(init?.signal instanceof AbortSignal);
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    throw abortError;
  }) as typeof fetch;
  const timeout = await getLibrarySeatRoomsAPI("token");
  assert.equal(timeout.success, false);
  if (timeout.success) assert.fail("expected timeout");
  assert.equal(timeout.failureKind, "timeout");
  assert.equal(timeout.needLogin, undefined);
  assert.deepEqual(capturedErrors, []);
  assert.equal(consoleWarnings.length, 2);
});

test("HTML 등 잘못된 좌석 응답은 invalid_response로 분류한다", async (t) => {
  resetRuntimeStubs();
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>blocked</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
  );

  const response = await getLibrarySeatRoomsAPI("token");

  assert.equal(response.success, false);
  if (response.success) assert.fail("expected invalid response");
  assert.equal(response.failureKind, "invalid_response");
  assert.equal(response.needLogin, undefined);
  assert.equal(capturedErrors.length, 1);
});

test("정상적인 빈 열람실 목록은 로그인 실패로 오인하지 않는다", async (t) => {
  resetRuntimeStubs();
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      success: true,
      code: "0",
      message: "",
      data: { totalCount: 0, list: [] },
    }),
  );

  const response = await getLibrarySeatRoomsAPI("token");

  assert.equal(response.success, true);
  if (!response.success) assert.fail(response.error);
  assert.deepEqual(response.data.list, []);
});

test("거절된 저장 토큰은 지우고 재로그인은 정확히 한 번만 수행한다", async () => {
  const calls = { clear: 0, login: 0, seats: [] as string[] };
  const loginData = { accessToken: "fresh-token" } as LibraryLoginData;
  const dependencies: LibrarySeatRoomsSessionDependencies = {
    getStoredToken: async () => "stale-token",
    clearStoredToken: async () => {
      calls.clear += 1;
      return true;
    },
    login: async () => {
      calls.login += 1;
      return { success: true, data: loginData };
    },
    setToken: async () => true,
    getSeatRooms: async (token) => {
      calls.seats.push(token);
      if (token === "stale-token") {
        return {
          success: false,
          failureKind: "auth",
          error: "expired",
          needLogin: true,
        };
      }
      return { success: true, data: { totalCount: 0, list: [] } };
    },
  };

  const response = await loadLibrarySeatRoomsAPI(
    { id: "student", password: "saved-password" },
    dependencies,
  );

  assert.equal(response.success, true);
  assert.deepEqual(calls, {
    clear: 1,
    login: 1,
    seats: ["stale-token", "fresh-token"],
  });
});
