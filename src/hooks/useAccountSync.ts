import { useEffect } from "react";
import { isLoggedIn } from "@/utils/oauth";
import { getGoogleAccountId, initializeAccountProfile } from "@/apis/supabase/account";
import { isSupabaseConfigured } from "@/apis/supabase/client";
import {
  activateSyncAccount,
  getActiveSyncAccountId,
  SyncAccountMismatchError,
} from "@/storage/account/syncRepository";
import { syncAccount } from "@/utils/accountSync";
import { isExpectedNetworkFailure } from "@/utils/networkFailure";
import { captureErrorLog } from "@/utils/logger";
import { recordBreadcrumb } from "@/monitoring";
import { UserFacingError } from "@/errors/userFacingError";
import { withAccountLock } from "@/utils/accountLock";
import { toast } from "sonner";

export function useAccountSync(): void {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let disposed = false;

    const run = async () => {
      const boundAccountId = await getActiveSyncAccountId();
      if (!boundAccountId || !(await isLoggedIn())) return;
      const result = await syncAccount();
      if (!disposed && result.conflicts > 0) {
        toast.info("다른 기기의 변경을 반영했습니다.", {
          description: result.firstError ?? "수정 중이던 템플릿의 충돌은 복사본으로 보관합니다. 아이콘은 최신 서버 상태를 확인해 주세요.",
        });
      }
      if (!disposed && result.failed > 0) {
        recordBreadcrumb(
          "account.sync",
          "background sync completed with deferred operations",
          { failed: result.failed, conflicts: result.conflicts },
          "warning",
        );
      }
    };

    const initialize = async () => {
      await withAccountLock(async () => {
        const accountId = await getGoogleAccountId();
        if (accountId) {
          await activateSyncAccount(accountId);
          await initializeAccountProfile();
        }
      });
      await run();
    };

    const report = (error: unknown) => {
      if (
        error instanceof SyncAccountMismatchError ||
        error instanceof UserFacingError ||
        isExpectedNetworkFailure(error)
      ) {
        recordBreadcrumb(
          "account.sync",
          "automatic sync unavailable",
          {
            reason:
              error instanceof SyncAccountMismatchError
                ? "account_mismatch"
                : error instanceof UserFacingError
                  ? error.code
                  : "network",
          },
          "warning",
        );
        return;
      }
      captureErrorLog("[Account sync] Automatic sync failed", error);
    };

    const trigger = () => {
      void run().catch(report);
    };
    void initialize().catch(report);
    window.addEventListener("auth:login", trigger);
    window.addEventListener("online", trigger);
    window.addEventListener("linku:templates-changed", trigger);
    return () => {
      disposed = true;
      window.removeEventListener("auth:login", trigger);
      window.removeEventListener("online", trigger);
      window.removeEventListener("linku:templates-changed", trigger);
    };
  }, []);
}
