import assert from "node:assert/strict";
import test from "node:test";

import { looksEncrypted } from "../../src/utils/credentialFormat.ts";

const SALT_HEX = "a".repeat(32); // 16 bytes
const IV_HEX = "b".repeat(24); // 12 bytes
const CIPHER = "3q2+7w==";

test("암호화 형식을 인식한다", () => {
  assert.equal(looksEncrypted(`${SALT_HEX}:${IV_HEX}:${CIPHER}`), true);
  // hex는 대소문자를 가리지 않는다.
  assert.equal(
    looksEncrypted(`${SALT_HEX.toUpperCase()}:${IV_HEX}:${CIPHER}`),
    true,
  );
});

test("평문 비밀번호를 암호문으로 오인하지 않는다", () => {
  for (const value of [
    "",
    "password",
    "p@ssw0rd!",
    "한글비밀번호",
    "a:b:c",
    "12:34:56", // 시각처럼 콜론이 있는 값
    "user:pass:extra:more",
  ]) {
    assert.equal(looksEncrypted(value), false, `"${value}" 는 암호문이 아니다`);
  }
});

test("길이나 문자 집합이 어긋난 값을 거른다", () => {
  // salt가 짧다
  assert.equal(looksEncrypted(`${"a".repeat(30)}:${IV_HEX}:${CIPHER}`), false);
  // iv가 길다
  assert.equal(looksEncrypted(`${SALT_HEX}:${"b".repeat(26)}:${CIPHER}`), false);
  // hex가 아니다
  assert.equal(looksEncrypted(`${"z".repeat(32)}:${IV_HEX}:${CIPHER}`), false);
  // 빈 조각
  assert.equal(looksEncrypted(`${SALT_HEX}:${IV_HEX}:`), false);
});
