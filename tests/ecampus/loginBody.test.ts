import assert from "node:assert/strict";
import test from "node:test";

import { buildECampusLoginBody } from "../../src/apis/external/ecampusLoginBody.ts";

/** 서버가 form-urlencoded 본문을 해석하는 방식과 동일하게 되읽는다. */
function parse(body: string): URLSearchParams {
  return new URLSearchParams(body);
}

test("고정 필드가 그대로 실린다", () => {
  const parsed = parse(buildECampusLoginBody("202011111", "password"));

  assert.equal(parsed.get("usr_id"), "202011111");
  assert.equal(parsed.get("usr_pwd"), "password");
  assert.equal(parsed.get("campus_div"), "1");
  assert.equal(parsed.get("encoding"), "utf-8");
});

test("구분자가 든 비밀번호가 깨지지 않는다", () => {
  // 수정 전에는 비밀번호가 "a"로 잘리고 campus_div가 2로 덮어써졌다.
  const parsed = parse(buildECampusLoginBody("202011111", "a&campus_div=2"));

  assert.equal(parsed.get("usr_pwd"), "a&campus_div=2");
  assert.equal(parsed.get("campus_div"), "1", "고정 필드가 덮어써지면 안 된다");
});

test("+ 가 공백으로 바뀌지 않는다", () => {
  // 수정 전에는 서버가 "pa ss"로 읽었다.
  const parsed = parse(buildECampusLoginBody("202011111", "pa+ss"));

  assert.equal(parsed.get("usr_pwd"), "pa+ss");
});

test("특수문자와 한글 비밀번호가 왕복한다", () => {
  for (const password of [
    "p@ssw0rd!",
    "100%",
    "p=w",
    "a b",
    "한글비밀번호",
    "#hash&amp=1",
    '"quoted"',
    "back\\slash",
  ]) {
    const parsed = parse(buildECampusLoginBody("202011111", password));
    assert.equal(parsed.get("usr_pwd"), password, `${password} 가 보존되어야 한다`);
    assert.equal(parsed.get("campus_div"), "1");
  }
});

test("ID에 구분자가 들어가도 필드가 늘지 않는다", () => {
  const parsed = parse(buildECampusLoginBody("id&usr_pwd=injected", "real-pw"));

  assert.equal(parsed.get("usr_id"), "id&usr_pwd=injected");
  assert.equal(parsed.get("usr_pwd"), "real-pw");
  assert.deepEqual(
    [...parsed.keys()].sort(),
    ["campus_div", "encoding", "usr_id", "usr_pwd"],
  );
});
