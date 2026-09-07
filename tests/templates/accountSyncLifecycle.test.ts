import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";
import { createTemplateTestServer } from "./viteTestServer.ts";
import type { Template } from "../../src/types/api.ts";
import type { RemoteTemplate } from "../../src/types/account.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test("실제 로그인·동기화 service의 계정 및 응답 순서 경계", async (t) => {
  let sessionId: string | null = "account-A";
  let loginAccount = "account-A";
  let exchanges = 0;
  let requests = 0;
  let launch = async () => "https://local.chromiumapp.org/supabase?code=test-code";
  const template: Template = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", templateId: 1,
    name: "local", height: 1, cloned: false, syncStatus: "local", items: [],
    createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z",
  };
  const remote: RemoteTemplate = {
    id: template.id, revision: 2, contentHash: "a".repeat(64), deletedAt: null,
    updatedAt: template.updatedAt,
    document: {
      version: 1, name: "remote", height: 1, cloned: false, items: [], stagingItems: [],
      createdAt: template.createdAt, updatedAt: template.updatedAt,
    },
  };
  let listTemplates = async (): Promise<RemoteTemplate[]> => [];
  let fetchTemplate = async (): Promise<RemoteTemplate | null> => remote;
  let putTemplate: (...args: unknown[]) => Promise<RemoteTemplate> = async () => remote;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: sessionId ? { user: {
        id: sessionId, app_metadata: { provider: "google" },
      } } : null }, error: null }),
      signInWithOAuth: async () => ({ data: { url: "https://auth.example/authorize" }, error: null }),
      exchangeCodeForSession: async () => { exchanges++; sessionId = loginAccount; return { error: null }; },
      signOut: async () => { sessionId = null; return { error: null }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nickname: "tester" }, error: null }) }) }) }),
  };
  const testGlobal = globalThis as typeof globalThis & { linkuAccountTest?: unknown };
  testGlobal.linkuAccountTest = {
    client,
    clearSession: () => { sessionId = null; },
    listRemoteAssets: async () => { requests++; return []; },
    listRemoteTemplates: () => listTemplates(),
    getRemoteTemplate: () => fetchTemplate(),
    putRemoteTemplate: (...args: unknown[]) => putTemplate(...args),
  };
  const previousChrome = globalThis.chrome;
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
    identity: { getRedirectURL: () => "https://local.chromiumapp.org/supabase", launchWebAuthFlow: () => launch() },
  } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  const server = await createTemplateTestServer([{
    name: "account-test-transport",
    load(id) {
      if (id.endsWith("/src/apis/supabase/client.ts")) return `
        export class SupabaseConfigurationError extends Error {}
        export const getSupabaseClient = () => globalThis.linkuAccountTest.client;
        export const clearStoredSupabaseSession = async () => globalThis.linkuAccountTest.clearSession();
        export const clearLegacyAuthStorage = async () => {};
      `;
      if (id.endsWith("/src/apis/supabase/templates.ts")) return [
        "listRemoteAssets", "listRemoteTemplates", "getRemoteTemplate", "putRemoteTemplate",
        "downloadRemoteAsset", "uploadRemoteAsset", "deleteRemoteTemplate",
      ].map(name => `export const ${name} = (...args) => globalThis.linkuAccountTest.${name}(...args);`).join("\n");
    },
  }]);
  try {
    const { getLinkuDb } = await server.ssrLoadModule("/src/storage/indexedDb/linkuDatabase.ts") as typeof import("../../src/storage/indexedDb/linkuDatabase.ts");
    const repository = await server.ssrLoadModule("/src/storage/templates/repository.ts") as typeof import("../../src/storage/templates/repository.ts");
    const syncRepository = await server.ssrLoadModule("/src/storage/account/syncRepository.ts") as typeof import("../../src/storage/account/syncRepository.ts");
    const { syncAccount } = await server.ssrLoadModule("/src/utils/accountSync.ts") as typeof import("../../src/utils/accountSync.ts");
    const { signOutAccount } = await server.ssrLoadModule("/src/apis/supabase/account.ts") as typeof import("../../src/apis/supabase/account.ts");
    const { handleGoogleLogin } = await server.ssrLoadModule("/src/background/handlers/oauth.ts") as typeof import("../../src/background/handlers/oauth.ts");
    const { SyncConflictError } = await server.ssrLoadModule("/src/apis/supabase/errors.ts") as typeof import("../../src/apis/supabase/errors.ts");
    const db = await getLinkuDb();
    const prepare = async () => {
      for (const name of ["templates", "outbox", "syncMeta", "settings"] as const) await db.clear(name);
      sessionId = "account-A";
      requests = 0;
      await repository.saveLocalTemplate(template);
      await syncRepository.activateSyncAccount("account-A");
      await db.clear("outbox");
      await db.put("syncMeta", { key: `account-A:template:${template.id}`, revision: 1 });
      listTemplates = async () => [];
      fetchTemplate = async () => remote;
    };

    await t.test("동시에 처음 연결하는 두 계정 중 하나만 연결된다", async () => {
      await syncRepository.resetSyncConnection();
      const results = await Promise.allSettled([
        syncRepository.activateSyncAccount("account-A"),
        syncRepository.activateSyncAccount("account-B"),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.filter(result => result.status === "rejected").length, 1);
      assert.equal(await syncRepository.getActiveSyncAccountId(), "account-A");
    });

    await t.test("계정 불일치·로그아웃 상태에서는 원격 요청이 하나도 나가지 않는다", async () => {
      await prepare();
      sessionId = "account-B";
      await assert.rejects(syncAccount(), { name: "SyncAccountMismatchError" });
      sessionId = null;
      await assert.rejects(syncAccount(), { code: "LOGIN_REQUIRED" });
      assert.equal(requests, 0);
    });

    await t.test("원격 응답 대기 중 저장한 편집을 보존하고 재요청을 이어서 처리한다", async () => {
      await prepare();
      const started = deferred<void>();
      const reply = deferred<RemoteTemplate[]>();
      listTemplates = async () => { started.resolve(); return reply.promise; };
      const first = syncAccount();
      await started.promise;
      await repository.saveLocalTemplate({ ...template, name: "newest local" });
      let pushedName = "";
      putTemplate = async (_id, document) => {
        pushedName = (document as { name: string }).name;
        return { ...remote, revision: 3 };
      };
      const again = syncAccount();
      assert.equal(first, again);
      reply.resolve([remote]);
      await first;
      assert.equal(pushedName, "newest local");
      assert.equal((await db.get("templates", 1))?.template.name, "newest local");
      assert.equal(await db.count("outbox"), 0);
    });

    await t.test("충돌 응답 도중 재편집하면 최신 작업과 기준 revision을 보존한다", async () => {
      await prepare();
      await repository.saveLocalTemplate(template);
      const started = deferred<void>();
      const reply = deferred<RemoteTemplate | null>();
      putTemplate = async () => { throw new SyncConflictError(); };
      fetchTemplate = async () => { started.resolve(); return reply.promise; };
      const syncing = syncAccount();
      await started.promise;
      await repository.saveLocalTemplate({ ...template, name: "newer during conflict" });
      reply.resolve(remote);
      const result = await syncing;
      assert.equal(result.conflicts, 0);
      assert.equal((await db.get("templates", 1))?.template.name, "newer during conflict");
      assert.equal((await db.get("syncMeta", `account-A:template:${template.id}`))?.revision, 1);
      assert.equal(await db.count("outbox"), 1);
    });

    await t.test("로그아웃은 진행 중인 동기화가 끝난 뒤 세션을 지운다", async () => {
      await prepare();
      const started = deferred<void>();
      const reply = deferred<RemoteTemplate[]>();
      listTemplates = async () => { started.resolve(); return reply.promise; };
      const syncing = syncAccount();
      await started.promise;
      const logout = signOutAccount();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(sessionId, "account-A");
      reply.resolve([]);
      await Promise.all([syncing, logout]);
      assert.equal(sessionId, null);
    });

    await t.test("팝업이 없어도 background가 계정 연결을 완료하며 중복 콜백을 교환하지 않는다", async () => {
      await prepare();
      await syncRepository.resetSyncConnection();
      sessionId = null;
      loginAccount = "account-A";
      exchanges = 0;
      const reply = deferred<string>();
      launch = () => reply.promise;
      const first = handleGoogleLogin();
      const duplicate = handleGoogleLogin();
      assert.equal(first, duplicate);
      reply.resolve("https://local.chromiumapp.org/supabase?code=test-code");
      assert.equal((await first).success, true);
      assert.equal(exchanges, 1);
      assert.equal(await syncRepository.getActiveSyncAccountId(), "account-A");
      assert.equal(await db.count("outbox"), 1);
    });

    await t.test("다른 계정 로그인은 background에서 거부하고 새 세션을 제거한다", async () => {
      await prepare();
      loginAccount = "account-B";
      launch = async () => "https://local.chromiumapp.org/supabase?code=test-code";
      const result = await handleGoogleLogin();
      assert.equal(result.success, false);
      assert.equal(sessionId, null);
      assert.equal(await syncRepository.getActiveSyncAccountId(), "account-A");
    });

    await t.test("허용되지 않은 callback과 사용자 취소는 token 교환을 하지 않는다", async () => {
      exchanges = 0;
      launch = async () => "https://other.example/supabase?code=test-code";
      assert.equal((await handleGoogleLogin()).success, false);
      launch = async () => { throw new Error("The user did not approve access."); };
      assert.equal((await handleGoogleLogin()).success, false);
      assert.equal(exchanges, 0);
    });
  } finally {
    await server.close();
    delete testGlobal.linkuAccountTest;
    Object.defineProperty(globalThis, "chrome", { configurable: true, value: previousChrome });
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
