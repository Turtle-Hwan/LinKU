import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import { UserFacingError } from "@/errors/userFacingError";

const EXPECTED_MESSAGES: Record<string, string> = {
  ASSET_LIMIT_REACHED: "계정에는 사용자 아이콘을 최대 100개까지 동기화할 수 있습니다.",
  GOOGLE_ACCOUNT_REQUIRED: "Google 계정으로 로그인해 주세요.",
  INVALID_NICKNAME: "닉네임은 1자 이상 32자 이하로 입력해 주세요.",
  INVALID_TEMPLATE: "템플릿 데이터가 올바르지 않습니다.",
  LOGIN_REQUIRED: "Google 로그인이 필요합니다.",
  PUBLICATION_ACTIVE: "게시 중인 템플릿은 게시를 내린 뒤 삭제해 주세요.",
  PUBLICATION_LIMIT_REACHED: "계정당 최대 25개의 템플릿을 게시할 수 있습니다.",
  PUBLICATION_NOT_FOUND: "게시물을 찾을 수 없습니다.",
  TEMPLATE_LIMIT_REACHED: "계정에는 템플릿을 최대 100개까지 동기화할 수 있습니다.",
  TEMPLATE_NOT_FOUND: "동기화된 템플릿을 찾을 수 없습니다.",
};

export class SyncConflictError extends UserFacingError {
  constructor() {
    super("다른 기기의 변경과 겹쳤습니다.", "SYNC_CONFLICT");
    this.name = "SyncConflictError";
  }
}

export function toSupabaseUserError(
  error: PostgrestError,
  fallback: string,
): Error {
  if (error.code === "40001" || error.message === "LINKU_CONFLICT") {
    return new SyncConflictError();
  }
  const message = EXPECTED_MESSAGES[error.message];
  return message
    ? new UserFacingError(message, error.message)
    : Object.assign(new Error(fallback), { code: error.code });
}

export function toSupabaseAuthError(
  error: AuthError,
  fallback: string,
): Error {
  const status = Number(error.status);
  const code = typeof error.code === "string" ? error.code : undefined;
  if (Number.isFinite(status) && status >= 400 && status < 500) {
    return new UserFacingError(fallback, code ?? "AUTH_REQUEST_FAILED");
  }
  return Object.assign(new Error(fallback), {
    status: Number.isFinite(status) ? status : undefined,
    code,
  });
}

export function toSupabaseStorageError(
  error: unknown,
  fallback: string,
): Error {
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const status = Number(candidate?.status ?? candidate?.statusCode);
  const code =
    typeof candidate?.code === "string" ? candidate.code : undefined;

  if (Number.isFinite(status) && status >= 500) {
    return Object.assign(new Error(fallback), { status, code });
  }
  return new UserFacingError(fallback, code ?? "STORAGE_REQUEST_FAILED");
}
