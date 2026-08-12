import assert from "node:assert/strict";
import test from "node:test";

import {
  eCampusCredentialsSchema,
  LINK_NAME_MAX_LENGTH,
  linkFormSchema,
  qrUrlSchema,
  todoInputSchema,
} from "../../src/utils/formValidation.ts";

function expectError(
  result: ReturnType<typeof linkFormSchema.safeParse>,
  message: string,
) {
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.message, message);
  }
}

test("링크 폼은 공백을 정리하고 기존 오류 문구를 유지한다", () => {
  const result = linkFormSchema.safeParse({
    name: "  eCampus  ",
    url: " https://ecampus.konkuk.ac.kr ",
    iconId: 1,
  });

  assert.deepEqual(result, {
    success: true,
    data: {
      name: "eCampus",
      url: "https://ecampus.konkuk.ac.kr",
      iconId: 1,
    },
  });

  expectError(
    linkFormSchema.safeParse({ name: "", url: "https://example.com", iconId: 1 }),
    "링크 이름을 입력해주세요.",
  );
  expectError(
    linkFormSchema.safeParse({ name: "링크", url: "not-a-url", iconId: 1 }),
    "올바른 URL을 입력해주세요.",
  );
  const maxLengthName = "가".repeat(LINK_NAME_MAX_LENGTH);
  assert.equal(
    linkFormSchema.safeParse({
      name: maxLengthName,
      url: "https://example.com",
      iconId: 1,
    }).success,
    true,
  );
  expectError(
    linkFormSchema.safeParse({
      name: `${maxLengthName}가`,
      url: "https://example.com",
      iconId: 1,
    }),
    `링크 이름은 ${LINK_NAME_MAX_LENGTH}자 이하로 입력해주세요.`,
  );
  expectError(
    linkFormSchema.safeParse({ name: "링크", url: "https://example.com", iconId: null }),
    "아이콘을 선택해주세요.",
  );
});

test("Todo, eCampus, QR 입력은 소비 전에 하나의 스키마로 검증한다", () => {
  assert.deepEqual(
    todoInputSchema.safeParse({
      title: "  과제 제출  ",
      subject: "  자료구조  ",
      dueDate: "2026-08-10",
      dueTime: "23:59",
    }),
    {
      success: true,
      data: {
        title: "과제 제출",
        subject: "자료구조",
        dueDate: "2026-08-10",
        dueTime: "23:59",
      },
    },
  );
  assert.equal(
    todoInputSchema.safeParse({
      title: "",
      subject: "",
      dueDate: "2026-08-10",
      dueTime: "23:59",
    }).success,
    false,
  );
  assert.equal(
    eCampusCredentialsSchema.safeParse({ userId: "student", userPw: "password" }).success,
    true,
  );
  assert.equal(
    eCampusCredentialsSchema.safeParse({ userId: "", userPw: "password" }).success,
    false,
  );
  assert.deepEqual(qrUrlSchema.safeParse(" https://linku.turtlehwan.dev "), {
    success: true,
    data: "https://linku.turtlehwan.dev",
  });
  assert.equal(qrUrlSchema.safeParse("not-a-url").success, false);
});
