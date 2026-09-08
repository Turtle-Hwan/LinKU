/**
 * Shared input schemas.
 *
 * Keep user-facing validation messages close to their constraints so every
 * form consumes the same rules without rebuilding conditional checks.
 */
import * as z from "zod/mini";

export const LINK_NAME_MAX_LENGTH = 15;

const trimmedString = () => z.string().check(z.trim());

export const linkNameSchema = trimmedString().check(
  z.minLength(1, "링크 이름을 입력해주세요."),
  z.maxLength(
    LINK_NAME_MAX_LENGTH,
    `링크 이름은 ${LINK_NAME_MAX_LENGTH}자 이하로 입력해주세요.`,
  ),
);

export const linkUrlSchema = z.pipe(
  trimmedString().check(z.minLength(1, "링크 URL을 입력해주세요.")),
  z.url("올바른 URL을 입력해주세요."),
);

const iconIdSchema = z.number("아이콘을 선택해주세요.").check(
  z.refine((iconId) => iconId > 0, "아이콘을 선택해주세요."),
);

export const linkFormSchema = z.object({
  name: linkNameSchema,
  url: linkUrlSchema,
  iconId: iconIdSchema,
});

export const todoInputSchema = z.object({
  title: trimmedString().check(z.minLength(1, "할 일 제목을 입력해주세요.")),
  subject: trimmedString(),
  dueDate: z.string().check(z.minLength(1, "마감일을 선택해주세요.")),
  dueTime: z.string().check(z.minLength(1, "마감 시간을 선택해주세요.")),
});

export const eCampusCredentialsSchema = z.object({
  userId: z.string().check(z.minLength(1, "ID와 비밀번호를 모두 입력해주세요.")),
  userPw: z.string().check(z.minLength(1, "ID와 비밀번호를 모두 입력해주세요.")),
});

export const qrUrlSchema = z.pipe(
  trimmedString().check(z.minLength(1, "올바른 URL 형식이 아닙니다")),
  z.url("올바른 URL 형식이 아닙니다"),
);

export function getFirstValidationMessage(error: {
  issues: Array<{ message: string }>;
}) {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}
