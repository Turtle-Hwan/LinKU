import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import {
  eCampusGoLectureAPI,
  LOCAL_SAMPLE_LECTURE_URL,
} from "@/apis";
import { useECampusAuth } from "@/hooks/useECampusAuth";
import { useTodoSettings } from "@/hooks/useTodoSettings";
import type { CustomTodoItem, ECampusTodoItem, TodoItem } from "@/types/todo";
import {
  sendTodoItemComplete,
  sendTodoItemDelete,
  sendTodoView,
} from "@/utils/analytics";
import { errorLog } from "@/utils/logger";
import { syncTodoCount } from "@/utils/todo/count";
import {
  deleteCustomTodo,
  getCustomTodos,
  toggleCustomTodo,
} from "@/utils/todo/customTodo";
import { getTodoDeadline } from "@/utils/todo/dateFormat";

type LoginResult = string | null;

export function useTodoListData() {
  const viewOpenSentRef = useRef(false);
  const ecampusTodosRef = useRef<ECampusTodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isECampusLoading, setIsECampusLoading] = useState(false);
  const [ecampusTodos, setECampusTodos] = useState<ECampusTodoItem[]>([]);
  const [customTodos, setCustomTodos] = useState<CustomTodoItem[]>([]);
  const [ecampusError, setECampusError] = useState("");
  const [ecampusNeedsLogin, setECampusNeedsLogin] = useState(false);
  const {
    handleLoginModalOpenChange,
    loadECampusTodos: loadECampusTodosWithAuth,
    openLoginModal,
    showLoginModal,
  } = useECampusAuth();
  const {
    sortMethod,
    filterMode,
    timerEnabled,
    toggleSortMethod,
    toggleFilterMode,
  } = useTodoSettings();

  const allTodos: TodoItem[] = useMemo(() => {
    const filteredTodos =
      filterMode === "incomplete"
        ? [...ecampusTodos, ...customTodos].filter(
            (todo) => todo.type === "ecampus" || !todo.completed,
          )
        : [...ecampusTodos, ...customTodos];

    return filteredTodos.sort((a, b) => {
      const deadlineA = getTodoDeadline(a);
      const deadlineB = getTodoDeadline(b);

      return sortMethod === "dday-asc"
        ? deadlineA.getTime() - deadlineB.getTime()
        : deadlineB.getTime() - deadlineA.getTime();
    });
  }, [customTodos, ecampusTodos, filterMode, sortMethod]);

  const updateECampusTodos = useCallback((todos: ECampusTodoItem[]) => {
    ecampusTodosRef.current = todos;
    setECampusTodos(todos);
  }, []);

  const persistTodoCount = useCallback(
    async (
      customTodoList: CustomTodoItem[],
      ecampusTodoList: ECampusTodoItem[],
    ) => {
      await syncTodoCount({
        customTodos: customTodoList,
        ecampusTodos: ecampusTodoList,
      });
    },
    [],
  );

  const loadAndStoreCustomTodos = useCallback(async () => {
    try {
      const todos = await getCustomTodos();
      setCustomTodos(todos);
      return todos;
    } catch (error) {
      errorLog("Error loading custom todos:", error);
      return [];
    }
  }, []);

  const applyECampusResult = useCallback(
    async (
      result: Awaited<ReturnType<typeof loadECampusTodosWithAuth>>,
      customTodoList: CustomTodoItem[],
    ): Promise<LoginResult> => {
      if (result.success) {
        updateECampusTodos(result.todos);
        setECampusNeedsLogin(false);
        setECampusError("");
        await persistTodoCount(customTodoList, result.todos);
        return null;
      }

      updateECampusTodos([]);
      setECampusNeedsLogin(Boolean(result.needsLogin));
      setECampusError(result.needsLogin ? "" : (result.error ?? ""));
      await persistTodoCount(customTodoList, []);
      return result.error ?? (result.needsLogin ? "로그인이 필요합니다." : null);
    },
    [persistTodoCount, updateECampusTodos],
  );

  const loadTodoList = useCallback(async () => {
    setIsLoading(true);
    setECampusError("");
    setECampusNeedsLogin(false);

    const loadedCustomTodos = await loadAndStoreCustomTodos();
    await persistTodoCount(loadedCustomTodos, []);
    setIsLoading(false);

    setIsECampusLoading(true);
    try {
      const result = await loadECampusTodosWithAuth({
        allowAutoLogin: true,
        openLoginModal: false,
      });
      await applyECampusResult(result, loadedCustomTodos);
    } catch (error) {
      errorLog("Error loading eCampus todo list:", error);
      updateECampusTodos([]);
      setECampusNeedsLogin(false);
      setECampusError("eCampus 할 일을 불러오는 중 오류가 발생했습니다.");
      await persistTodoCount(loadedCustomTodos, []);
    } finally {
      setIsECampusLoading(false);
    }
  }, [
    applyECampusResult,
    loadAndStoreCustomTodos,
    loadECampusTodosWithAuth,
    persistTodoCount,
    updateECampusTodos,
  ]);

  useEffect(() => {
    void loadTodoList();
  }, [loadTodoList]);

  useEffect(() => {
    if (!isLoading && !isECampusLoading && !viewOpenSentRef.current) {
      viewOpenSentRef.current = true;
      void sendTodoView(ecampusTodos.length + customTodos.length);
    }
  }, [
    customTodos.length,
    ecampusTodos.length,
    isECampusLoading,
    isLoading,
  ]);

  const refreshCustomTodos = useCallback(async () => {
    const updatedCustomTodos = await loadAndStoreCustomTodos();
    await persistTodoCount(updatedCustomTodos, ecampusTodosRef.current);
  }, [loadAndStoreCustomTodos, persistTodoCount]);

  const handleLoginSuccess = useCallback(async (): Promise<LoginResult> => {
    setIsECampusLoading(true);

    try {
      const result = await loadECampusTodosWithAuth({
        allowAutoLogin: false,
        openLoginModal: false,
      });

      return await applyECampusResult(result, customTodos);
    } catch (error) {
      errorLog("Error loading eCampus todos after login:", error);
      updateECampusTodos([]);
      setECampusNeedsLogin(false);
      setECampusError(
        "eCampus 할 일을 다시 불러오는 중 오류가 발생했습니다.",
      );
      await persistTodoCount(customTodos, []);
      return "eCampus 할 일을 다시 불러오는 중 오류가 발생했습니다.";
    } finally {
      setIsECampusLoading(false);
    }
  }, [
    applyECampusResult,
    customTodos,
    loadECampusTodosWithAuth,
    persistTodoCount,
    updateECampusTodos,
  ]);

  const handleToggleTodo = useCallback(
    async (id: string) => {
      try {
        await toggleCustomTodo(id);
        await refreshCustomTodos();
        void sendTodoItemComplete("custom");
      } catch (error) {
        errorLog("Failed to toggle todo:", error);
        toast.error("상태 변경에 실패했습니다.");
      }
    },
    [refreshCustomTodos],
  );

  const handleDeleteTodo = useCallback(
    async (id: string) => {
      try {
        await deleteCustomTodo(id);
        await refreshCustomTodos();
        void sendTodoItemDelete("custom");
        toast.success("할 일이 삭제되었습니다.");
      } catch (error) {
        errorLog("Failed to delete todo:", error);
        toast.error("삭제에 실패했습니다.");
      }
    },
    [refreshCustomTodos],
  );

  const handleTodoAdded = useCallback(() => {
    void refreshCustomTodos();
  }, [refreshCustomTodos]);

  const handleTodoItemClick = useCallback(
    async (kj: string, seq: string, gubun: string) => {
      try {
        const result = await eCampusGoLectureAPI(kj, seq, gubun);

        if (result.success && result.message === LOCAL_SAMPLE_LECTURE_URL) {
          toast.info(
            "로컬 예시 eCampus 항목입니다. 실제 강의 페이지로는 이동하지 않습니다.",
          );
          return;
        }

        if (result.success && result.message) {
          window.open(
            `https://ecampus.konkuk.ac.kr${result.message}`,
            "_blank",
          );
        }
      } catch (error) {
        errorLog("Failed to navigate to lecture:", error);
      }
    },
    [],
  );

  return {
    allTodos,
    ecampusError,
    ecampusNeedsLogin,
    filterMode,
    handleDeleteTodo,
    handleOpenECampusLogin: openLoginModal,
    handleTodoAdded,
    handleTodoItemClick,
    handleToggleTodo,
    isECampusLoading,
    isLoading,
    loginDialogProps: {
      isOpen: showLoginModal,
      onOpenChange: handleLoginModalOpenChange,
      onLoginSuccess: handleLoginSuccess,
    },
    sortMethod,
    timerEnabled,
    toggleFilterMode,
    toggleSortMethod,
  };
}
