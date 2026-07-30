import { useCallback, useState } from "react";

import { toast } from "sonner";

import {
  loadECampusTodos as loadECampusTodosWithLogin,
  type LoadECampusTodosOptions,
  type LoadECampusTodosResult,
} from "@/utils/ecampus/todos";

interface UseECampusAuthOptions extends LoadECampusTodosOptions {
  openLoginModal?: boolean;
}

export function useECampusAuth() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLoginModalOpenChange = useCallback((open: boolean) => {
    setShowLoginModal(open);
  }, []);

  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const loadECampusTodos = useCallback(
    async (
      options: UseECampusAuthOptions = {},
    ): Promise<LoadECampusTodosResult> => {
      const {
        allowAutoLogin = true,
        openLoginModal: shouldOpenLoginModal = true,
      } = options;
      const result = await loadECampusTodosWithLogin({
        allowAutoLogin,
        clearExpiredCredentials: true,
      });

      if (result.loginOutcome === "auto-login-succeeded") {
        toast.success("eCampus에 자동 로그인되었습니다.");
      }

      if (result.loginOutcome === "credential-expired") {
        toast.error(
          "저장된 로그인 정보가 만료되었습니다. 다시 로그인해주세요.",
        );
      }

      if (!result.success && result.needsLogin && shouldOpenLoginModal) {
        setShowLoginModal(true);
      }

      return result;
    },
    [],
  );

  return {
    closeLoginModal,
    handleLoginModalOpenChange,
    loadECampusTodos,
    openLoginModal,
    showLoginModal,
  };
}
