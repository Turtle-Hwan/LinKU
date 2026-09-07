import { expect, test } from "../extension.fixture.ts";

test("MV3 로그인은 중복 요청·팝업 종료에도 한 번만 교환하고 계정을 연결한다", async ({ extension }) => {
  const { context, worker, popupUrl } = extension;
  // Real extension messaging, Supabase SDK, Web Locks and storage; provider HTTP is mocked.
  await context.route("https://**/*", route => route.abort());
  await worker.evaluate(() => {
    const state = { launches: 0, exchanges: 0, initializations: 0, nickname: "", validPkce: false, release: () => {} };
    Object.assign(globalThis, { loginTest: state });
    chrome.identity.launchWebAuthFlow = async (options) => {
      state.launches++;
      const url = new URL(options.url);
      state.validPkce = url.searchParams.get("code_challenge_method") === "s256"
        && Boolean(url.searchParams.get("code_challenge"));
      await new Promise<void>(resolve => { state.release = resolve; });
      return `${chrome.identity.getRedirectURL("supabase")}?code=mock-code`;
    };
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/auth/v1/token") {
        state.exchanges++;
        const payload = JSON.parse(String(init?.body));
        state.validPkce &&= payload.auth_code === "mock-code"
          && typeof payload.code_verifier === "string" && payload.code_verifier.length > 0;
        const user = {
          id: "11111111-1111-4111-8111-111111111111",
          aud: "authenticated", role: "authenticated",
          app_metadata: { provider: "google", providers: ["google"] }, user_metadata: {},
          created_at: new Date().toISOString(),
        };
        const encode = (value: unknown) => btoa(JSON.stringify(value))
          .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
        const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.${encode("test-signature")}`;
        return Response.json({
          access_token: token, refresh_token: "mock-refresh-token", token_type: "bearer",
          expires_in: 3600, user,
        });
      }
      if (url.pathname === "/rest/v1/profiles") {
        return Response.json(state.nickname ? { nickname: state.nickname } : null);
      }
      if (url.pathname === "/rest/v1/rpc/initialize_profile") {
        state.initializations++;
        state.nickname = JSON.parse(String(init?.body)).p_nickname;
        return Response.json({ user_id: "11111111-1111-4111-8111-111111111111", nickname: state.nickname });
      }
      return new Response(null, { status: 503 });
    };
  });

  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.evaluate(() => {
    void chrome.runtime.sendMessage({ type: "GOOGLE_LOGIN" }).catch(() => {});
    void chrome.runtime.sendMessage({ type: "GOOGLE_LOGIN" }).catch(() => {});
  });
  const counters = () => worker.evaluate(() => {
    const state = (globalThis as typeof globalThis & {
      loginTest: { launches: number; exchanges: number; initializations: number; nickname: string; validPkce: boolean };
    }).loginTest;
    return { launches: state.launches, exchanges: state.exchanges, initializations: state.initializations, nickname: state.nickname, validPkce: state.validPkce };
  });
  await expect.poll(async () => (await counters()).launches).toBe(1);
  await popup.close();
  await worker.evaluate(() => {
    (globalThis as typeof globalThis & { loginTest: { release: () => void } }).loginTest.release();
  });
  await expect.poll(async () => worker.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("linku");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string | undefined>((resolve, reject) => {
        const request = db.transaction("settings").objectStore("settings").get("active-sync-account");
        request.onsuccess = () => resolve(request.result?.value);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  })).toBe("11111111-1111-4111-8111-111111111111");
  expect(await counters()).toEqual({
    launches: 1, exchanges: 1, initializations: 1,
    nickname: expect.stringMatching(/^.+ (건구스|건덕이)$/u), validPkce: true,
  });
  expect(await worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("linku.supabase.auth.v1");
    return Boolean(stored["linku.supabase.auth.v1"]);
  })).toBe(true);
});
