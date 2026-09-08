import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateTestServer } from "./viteTestServer.ts";

test("손상된 게시물은 분리하되 페이지 위치와 정상 빈 템플릿을 보존한다", async () => {
  const valid = {
    template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    snapshot: { version: 1, name: "새 템플릿", height: 1, items: [] },
    revision: 1, author_nickname: "따뜻한 건구스", like_count: 0, clone_count: 0,
    published_at: "2026-09-08T00:00:00Z", updated_at: "2026-09-08T00:00:00Z", is_liked: false,
  };
  let rows: unknown[] = [valid];
  let rpcError: unknown = null;
  const reports: { error: Error; options: unknown }[] = [];
  const scope = globalThis as typeof globalThis & { communityValidationTest?: unknown };
  scope.communityValidationTest = {
    client: { rpc: async () => ({ data: rows, error: rpcError }) },
    reportError: (error: Error, options: unknown) => reports.push({ error, options }),
  };
  const server = await createTemplateTestServer([{
    name: "community-validation-transport",
    load(id) {
      if (id.endsWith("/src/apis/supabase/client.ts")) return `
        export const getSupabaseClient = () => globalThis.communityValidationTest.client;
        export const clearStoredSupabaseSession = async () => {};
      `;
      if (id.endsWith("/src/monitoring/index.ts")) return `
        export const reportError = (...args) => globalThis.communityValidationTest.reportError(...args);
        export const recordBreadcrumb = () => {};
        export const createErrorReporter = () => () => {};
      `;
    },
  }]);
  try {
    const api = await server.ssrLoadModule("/src/apis/supabase/community.ts") as typeof import("../../src/apis/supabase/community.ts");
    const first = await api.browsePublications();
    assert.equal(first.publications.length, 1);
    assert.deepEqual(first.publications[0].snapshot, valid.snapshot);
    assert.equal(first.fetchedCount, 1);
    assert.deepEqual(reports, []);

    const privateMarker = "never-log-this-snapshot";
    rows = [valid, { ...valid, snapshot: {} }, { ...valid, snapshot: { name: privateMarker } }];
    const mixed = await api.browsePublications();
    assert.deepEqual(mixed.publications, first.publications);
    assert.equal(mixed.fetchedCount, 3);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].error.message, "Invalid publication snapshots");
    assert.deepEqual(reports[0].options, { feature: "community", extras: { skippedCount: 2 } });
    assert.equal(JSON.stringify(reports).includes(privateMarker), false);

    rows = Array.from({ length: 12 }, () => ({ ...valid, snapshot: null }));
    assert.deepEqual(await api.browsePublications(), { publications: [], fetchedCount: 12 });
    rpcError = { code: "500", message: "unavailable" };
    await assert.rejects(api.browsePublications(), { message: "게시된 템플릿을 불러오지 못했습니다." });

    const { toSupabaseUserError } = await server.ssrLoadModule("/src/apis/supabase/errors.ts") as typeof import("../../src/apis/supabase/errors.ts");
    const error = toSupabaseUserError({ code: "22023", message: "INVALID_TEMPLATE", details: "", hint: "" }, "실패");
    assert.equal(error.name, "UserFacingError");
    assert.equal(error.message, "템플릿 정보가 누락되었거나 형식이 올바르지 않아 동기화하지 못했습니다. 편집 화면에서 확인한 뒤 다시 저장해 주세요.");
  } finally {
    await server.close();
    delete scope.communityValidationTest;
  }
});
