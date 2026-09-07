import assert from "node:assert/strict";
import test from "node:test";
import { generatePublicNickname } from "../../src/utils/publicNickname.ts";
import { createTemplateTestServer } from "./viteTestServer.ts";

test("공개 닉네임은 형용사와 마스코트를 조합한다", (t) => {
  const random = t.mock.method(Math, "random", () => 0);
  assert.equal(generatePublicNickname(), "따뜻한 건구스");
  random.mock.mockImplementation(() => 0.999999);
  assert.equal(generatePublicNickname(), "씩씩한 건덕이");
});

test("프로필 생성은 명시적으로 요청하고 기존 이름은 보존한다", async (t) => {
  let signedIn = true;
  let profile: { user_id: string; nickname: string } | null = null;
  let writes = 0;
  const transport = {
    auth: { getSession: async () => ({ data: { session: signedIn ? {
      user: { id: "account-A", app_metadata: { provider: "google" } },
    } : null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
    rpc: async (name: string, args: { p_nickname: string }) => {
      assert.ok(name === "initialize_profile" || name === "update_nickname");
      writes++;
      if (name === "update_nickname") profile = { user_id: "account-A", nickname: args.p_nickname };
      profile ??= { user_id: "account-A", nickname: args.p_nickname };
      return { data: profile, error: null };
    },
  };
  const scope = globalThis as typeof globalThis & { nicknameTestClient?: unknown };
  scope.nicknameTestClient = transport;
  const server = await createTemplateTestServer([{
    name: "nickname-test-transport",
    load(id) {
      if (id.endsWith("/src/apis/supabase/client.ts")) return `
        export const getSupabaseClient = () => globalThis.nicknameTestClient;
        export const clearStoredSupabaseSession = async () => {};
      `;
    },
  }]);
  try {
    const { getAccountProfile, initializeAccountProfile, updateAccountNickname } = await server.ssrLoadModule(
      "/src/apis/supabase/account.ts",
    ) as typeof import("../../src/apis/supabase/account.ts");
    await t.test("조회는 생성 요청을 하지 않는다", async () => {
      assert.equal(await getAccountProfile(), null);
      assert.equal(writes, 0);
    });
    await t.test("첫 초기화는 코드에서 만든 후보를 저장한다", async () => {
      const result = await initializeAccountProfile();
      assert.match(result!.nickname, /^.+ (건구스|건덕이)$/u);
      assert.equal(writes, 1);
    });
    await t.test("재초기화는 기존 이름을 읽고 추가 쓰기를 하지 않는다", async () => {
      profile = { user_id: "account-A", nickname: "직접 정한 이름" };
      assert.equal((await initializeAccountProfile())?.nickname, "직접 정한 이름");
      assert.equal(writes, 1);
    });
    await t.test("로그아웃 상태에서는 초기화하지 않는다", async () => {
      signedIn = false;
      assert.equal(await initializeAccountProfile(), null);
      assert.equal(writes, 1);
    });
    await t.test("닉네임 변경은 로그인 상태에서만 요청하고 저장 결과를 반환한다", async () => {
      await assert.rejects(updateAccountNickname("차가운 건덕이"), { code: "LOGIN_REQUIRED" });
      assert.equal(writes, 1);
      signedIn = true;
      assert.deepEqual(await updateAccountNickname("차가운 건덕이"), {
        userId: "account-A", nickname: "차가운 건덕이",
      });
      assert.equal(writes, 2);
    });
  } finally {
    await server.close();
    delete scope.nicknameTestClient;
  }
});
