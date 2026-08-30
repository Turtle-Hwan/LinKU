import type { AccountSyncResult } from "@/utils/accountSync";

export interface AccountSyncFeedback {
  title: string;
  description: string;
  destructive: boolean;
}

export function getAccountSyncFeedback(
  result: AccountSyncResult,
): AccountSyncFeedback {
  if (result.failed > 0) {
    const conflict = result.conflicts > 0 ? ` · 충돌 ${result.conflicts}개 복구` : "";
    return {
      title: "일부 동기화 지연",
      description: `${result.failed}개의 변경은 이 기기에 보존했습니다.${conflict} ${result.firstError ?? ""}`.trim(),
      destructive: true,
    };
  }
  if (result.conflicts > 0) {
    return {
      title: "동기화 충돌 정리 완료",
      description: `로컬 변경 ${result.conflicts}개를 별도 복사본으로 보존했습니다.`,
      destructive: false,
    };
  }
  const changes = [
    result.synced > 0 ? `올림 ${result.synced}개` : "",
    result.pulled > 0 ? `내려받음 ${result.pulled}개` : "",
  ].filter(Boolean);
  return {
    title: changes.length > 0 ? "동기화 완료" : "이미 최신 상태입니다",
    description: changes.join(" · ") || "추가로 동기화할 변경이 없습니다.",
    destructive: false,
  };
}
