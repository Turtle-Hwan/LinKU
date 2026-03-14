/**
 * eCampus 인증 및 Todo 목록 관리 Hook
 */
import { useState, useCallback } from 'react';
import { eCampusTodoListAPI, eCampusLoginAPI } from '@/apis';
import { loadECampusCredentials, clearECampusCredentials } from '@/utils/credentials';
import { ECampusTodoItem } from '@/types/todo';
import { toast } from 'sonner';

export function useECampusAuth() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  /**
   * Fetch eCampus Todo list
   */
  const fetchTodoList = useCallback(async (): Promise<{
    success: boolean;
    todos: ECampusTodoItem[];
  }> => {
    try {
      const result = await eCampusTodoListAPI();

      if (result.success && result.data?.todoList) {
        return { success: true, todos: result.data.todoList };
      }

      if (result.needLogin) {
        setShowLoginModal(true);
        return { success: false, todos: [] };
      }

      return { success: false, todos: [] };
    } catch (error) {
      console.error("Error fetching todo list:", error);
      return { success: false, todos: [] };
    }
  }, []);

  /**
   * Try auto-login with saved credentials
   */
  const tryAutoLogin = useCallback(async (): Promise<{
    success: boolean;
    todos: ECampusTodoItem[];
  }> => {
    try {
      const credentials = await loadECampusCredentials();
      if (!credentials) {
        return { success: false, todos: [] };
      }

      const loginResult = await eCampusLoginAPI(
        credentials.id,
        credentials.password
      );

      if (loginResult.success) {
        const todoResult = await fetchTodoList();
        if (todoResult.success) {
          toast.success("eCampus에 자동 로그인되었습니다.");
          return todoResult;
        }
      }

      /**
       * Handle login failure: distinguish temporary vs permanent errors
       * - Network error: keep credentials (auto-retry next time)
       * - Auth failed: clear credentials (user must re-enter)
       * - Unknown: keep credentials (safe fallback)
       */
      if (loginResult.error) {
        console.log("[Auto-login] Network error, keeping credentials:", loginResult.error);
        return { success: false, todos: [] };
      }

      if (loginResult.data?.isError) {
        console.log("[Auto-login] Auth failed, clearing credentials");
        await clearECampusCredentials();
        toast.error("저장된 로그인 정보가 만료되었습니다. 다시 로그인해주세요.");
        return { success: false, todos: [] };
      }

      console.log("[Auto-login] Unknown error, keeping credentials");
      return { success: false, todos: [] };
    } catch (error) {
      console.error("Error with saved credentials:", error);
      return { success: false, todos: [] }; // Keep credentials on exception
    }
  }, [fetchTodoList]);

  return {
    showLoginModal,
    setShowLoginModal,
    fetchTodoList,
    tryAutoLogin,
  };
}
