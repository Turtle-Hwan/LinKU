import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateTestServer } from "./viteTestServer.ts";

test("아이콘 metadata CRUD는 파일 재업로드와 분리되고 삭제 실패는 재시도한다", async (t) => {
  const original = { owner_id: "account-A", content_hash: "a".repeat(64), name: "아이콘", revision: 1 };
  let row: typeof original | null = null;
  const objectPath = `${original.owner_id}/${original.content_hash}.webp`;
  const blob = new Blob(["test"], { type: "image/webp" });
  let writeFailed = false;
  let persistOnFailure = false;
  let blocked = false;
  let fileDeleteFailed = false;
  let uploadError: { statusCode: string } | null = null;
  let uploads = 0;
  let removed = 0;
  const query = {
    select(columns: string) { assert.equal(columns, "content_hash, name, owner_id, revision"); return this; },
    eq() { return this; },
    maybeSingle: async () => ({ data: row, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: row ? [row] : [], error: null }).then(resolve),
  };
  const client = {
    from: () => query,
    rpc: async (name: string, args: { p_content_hash: string; p_name?: string; p_expected_revision?: number }) => {
      assert.equal(args.p_content_hash, original.content_hash);
      if (name === "delete_asset") {
        if (blocked) return { data: null, error: { code: "55000", message: "ASSET_IN_USE" } };
        row = null;
        return { data: null, error: null };
      }
      assert.equal(name, "put_asset");
      if (!writeFailed || persistOnFailure) row = { ...original, name: args.p_name!, revision: (row?.revision ?? 0) + 1 };
      return { data: row, error: writeFailed ? { code: "500", message: "failed" } : null };
    },
    storage: { from: () => ({
      upload: async (path: string, _blob: Blob, options: { upsert: boolean }) => {
        assert.equal(path, objectPath); assert.equal(options.upsert, false); uploads++; return { error: uploadError };
      },
      download: async (path: string) => { assert.equal(path, objectPath); return { data: blob, error: null }; },
      remove: async (paths: string[]) => {
        assert.deepEqual(paths, [objectPath]); removed++;
        return { error: fileDeleteFailed ? { statusCode: 503 } : null };
      },
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
    const expected = { contentHash: original.content_hash, name: original.name, objectPath, revision: 1 };
    const asset = { id: original.content_hash, name: original.name, blob, numericId: 1, dataUrl: "", createdAt: 0 };
    await t.test("최초 업로드와 조회에는 계산된 경로와 revision만 필요하다", async () => {
      assert.deepEqual(await api.uploadRemoteAsset(asset), expected);
      assert.deepEqual(await api.listRemoteAssets(), [expected]);
      assert.equal(await api.downloadRemoteAsset(expected), blob);
      assert.equal(uploads, 1);
    });
    await t.test("이름만 변경할 때 Storage를 호출하지 않는다", async () => {
      assert.equal((await api.putRemoteAsset(asset.id, "새 이름", 1)).name, "새 이름");
      assert.equal(uploads, 1);
      assert.equal(removed, 0);
    });
    await t.test("참조 검증에 실패하면 파일을 지우지 않는다", async () => {
      blocked = true;
      await assert.rejects(api.deleteRemoteAsset(asset.id, 2), { code: "ASSET_IN_USE" });
      assert.equal(removed, 0);
      blocked = false;
    });
    await t.test("metadata 삭제 후 파일 삭제 실패를 숨기지 않고 재시도한다", async () => {
      fileDeleteFailed = true;
      await assert.rejects(api.deleteRemoteAsset(asset.id, 2));
      assert.equal(row, null);
      fileDeleteFailed = false;
      await api.deleteRemoteAsset(asset.id, 2);
      assert.equal(removed, 2);
    });
    await t.test("응답만 실패한 업로드는 재조회 후 파일을 보존한다", async () => {
      writeFailed = true;
      persistOnFailure = true;
      assert.deepEqual(await api.uploadRemoteAsset(asset), expected);
      assert.equal(removed, 2);
    });
    await t.test("파일만 업로드된 상태의 재시도는 metadata 등록을 마친다", async () => {
      row = null;
      writeFailed = false;
      uploadError = { statusCode: "409" };
      assert.deepEqual(await api.uploadRemoteAsset(asset), expected);
      assert.equal(removed, 2);
      row = null;
      uploadError = { statusCode: "400" };
      await assert.rejects(api.uploadRemoteAsset(asset));
      assert.equal(row, null);
      uploadError = null;
    });
    await t.test("metadata가 확실히 없는 업로드 실패만 정리한다", async () => {
      row = null;
      writeFailed = true;
      persistOnFailure = false;
      await assert.rejects(api.uploadRemoteAsset(asset));
      assert.equal(removed, 3);
    });
  } finally {
    await server.close();
    delete scope.assetTestClient;
  }
});
