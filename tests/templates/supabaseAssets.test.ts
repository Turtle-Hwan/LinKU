import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateTestServer } from "./viteTestServer.ts";

test("아이콘 경로를 계산하고 메타데이터 재조회로 이미 저장된 파일을 보호한다", async () => {
  const row = { owner_id: "account-A", content_hash: "a".repeat(64), name: "아이콘" };
  const objectPath = `${row.owner_id}/${row.content_hash}.webp`;
  const blob = new Blob(["test"], { type: "image/webp" });
  let writeFailed = false;
  let persisted = true;
  let removed = 0;
  const query = {
    select(columns: string) {
      assert.equal(columns, "content_hash, name, owner_id");
      return this;
    },
    upsert(value: unknown) {
      assert.deepEqual(value, { content_hash: row.content_hash, name: row.name });
      return this;
    },
    eq() { return this; },
    single: async () => ({ data: row, error: writeFailed ? { code: "500", message: "failed" } : null }),
    maybeSingle: async () => ({ data: persisted ? row : null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve),
  };
  const client = {
    from: () => query,
    storage: { from: () => ({
      upload: async (path: string) => { assert.equal(path, objectPath); return { error: null }; },
      download: async (path: string) => { assert.equal(path, objectPath); return { data: blob, error: null }; },
      remove: async (paths: string[]) => { assert.deepEqual(paths, [objectPath]); removed++; return { error: null }; },
    }) },
  };
  const scope = globalThis as typeof globalThis & { assetTestClient?: unknown };
  scope.assetTestClient = client;
  const server = await createTemplateTestServer([{
    name: "asset-test-transport",
    load(id) {
      if (id.endsWith("/src/apis/supabase/client.ts")) return "export const getSupabaseClient = () => globalThis.assetTestClient;";
      if (id.endsWith("/src/apis/supabase/account.ts")) return 'export const getGoogleAccountId = async () => "account-A";';
    },
  }]);
  try {
    const api = await server.ssrLoadModule("/src/apis/supabase/templates.ts") as typeof import("../../src/apis/supabase/templates.ts");
    const expected = { contentHash: row.content_hash, name: row.name, objectPath };
    assert.deepEqual(await api.listRemoteAssets(), [expected]);
    const asset = { id: row.content_hash, name: row.name, blob, numericId: -1, dataUrl: "", createdAt: 0 };
    assert.deepEqual(await api.uploadRemoteAsset(asset), expected);
    assert.equal(await api.downloadRemoteAsset(expected), blob);
    writeFailed = true;
    assert.deepEqual(await api.uploadRemoteAsset(asset), expected);
    assert.equal(removed, 0);
    persisted = false;
    await assert.rejects(api.uploadRemoteAsset(asset));
    assert.equal(removed, 1);
  } finally {
    await server.close();
    delete scope.assetTestClient;
  }
});
