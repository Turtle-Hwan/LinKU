import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
import { subscribeECampusTodosChange } from "@/utils/ecampus/todos";
import { resolveECampusTodosAfterLoad } from "@/utils/ecampus/todoState";
import { captureErrorLog } from "@/utils/logger";
import {
  syncTodoCountAfterCustomChange,
  syncTodoCountWithECampusTodos,
} from "@/utils/todo/count";
import {
  deleteCustomTodo,
  getCustomTodos,
  toggleCustomTodo,
} from "@/utils/todo/customTodo";
import { getTodoDeadline } from "@/utils/todo/dateFormat";

type LoginResult = string | null;

export function useTodoListData() {
  const viewOpenSentRef = useRef(false);
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
    setECampusTodos(todos);
  }, []);

  const loadAndStoreCustomTodos = useCallback(async (): Promise<boolean> => {
    try {
      const todos = await getCustomTodos();
      setCustomTodos(todos);
      return true;
    } catch (error) {
      captureErrorLog("Error loading custom todos:", error);
      setCustomTodos([]);
      return false;
    }
  }, []);

  const applyECampusResult = useCallback(
    async (
      result: Awaited<ReturnType<typeof loadECampusTodosWithAuth>>,
    ): Promise<LoginResult> => {
      if (result.superseded) {
        return null;
      }

      setECampusTodos((currentTodos) =>
        resolveECampusTodosAfterLoad(currentTodos, result),
      );

      if (result.success) {
        setECampusNeedsLogin(false);
        setECampusError("");
        await syncTodoCountWithECampusTodos(result.todos);
        return null;
      }

      setECampusNeedsLogin(Boolean(result.needsLogin));
      setECampusError(result.needsLogin ? "" : (result.error ?? ""));
      if (result.needsLogin) {
        await syncTodoCountWithECampusTodos([]);
      } else {
        await syncTodoCountAfterCustomChange();
      }
      return result.error ?? (result.needsLogin ? "로그인이 필요합니다." : null);
    },
    [],
  );

  const loadECampusTodoList = useCallback(async () => {
    setECampusError("");
    setECampusNeedsLogin(false);
    setIsECampusLoading(true);

    try {
      const result = await loadECampusTodosWithAuth({
        allowAutoLogin: true,
        openLoginModal: false,
      });
      await applyECampusResult(result);
    } catch (error) {
      captureErrorLog("Error loading eCampus todo list:", error);
      setECampusNeedsLogin(false);
      setECampusError("eCampus 할 일을 불러오는 중 오류가 발생했습니다.");
      await syncTodoCountAfterCustomChange();
    } finally {
      setIsECampusLoading(false);
    }
  }, [
    applyECampusResult,
    loadECampusTodosWithAuth,
  ]);

  const loadTodoList = useCallback(async () => {
    setIsLoading(true);

    try {
      const customTodosLoaded = await loadAndStoreCustomTodos();
      if (customTodosLoaded) {
        await syncTodoCountAfterCustomChange();
      }
    } catch (error) {
      captureErrorLog("Error syncing custom todo count:", error);
    } finally {
      setIsLoading(false);
    }

    await loadECampusTodoList();
  }, [loadAndStoreCustomTodos, loadECampusTodoList]);

  useEffect(() => {
    void loadTodoList();
  }, [loadTodoList]);

  useEffect(() => {
    return subscribeECampusTodosChange((change) => {
      if (change === "clear") {
        updateECampusTodos([]);
        setECampusError("");
        setECampusNeedsLogin(false);
        setIsECampusLoading(false);
        return;
      }

      void loadECampusTodoList();
    });
  }, [loadECampusTodoList, updateECampusTodos]);

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
    const customTodosLoaded = await loadAndStoreCustomTodos();
    if (customTodosLoaded) {
      await syncTodoCountAfterCustomChange();
    }
  }, [loadAndStoreCustomTodos]);

  const handleLoginSuccess = useCallback(async (
    expectedGeneration: number,
  ): Promise<LoginResult> => {
    setIsECampusLoading(true);

    try {
      const result = await loadECampusTodosWithAuth({
        allowAutoLogin: false,
        openLoginModal: false,
        expectedGeneration,
      });

      return await applyECampusResult(result);
    } catch (error) {
      captureErrorLog("Error loading eCampus todos after login:", error);
      setECampusNeedsLogin(false);
      setECampusError(
        "eCampus 할 일을 다시 불러오는 중 오류가 발생했습니다.",
      );
      await syncTodoCountAfterCustomChange();
      return "eCampus 할 일을 다시 불러오는 중 오류가 발생했습니다.";
    } finally {
      setIsECampusLoading(false);
    }
  }, [
    applyECampusResult,
    loadECampusTodosWithAuth,
  ]);

  const handleToggleTodo = useCallback(
    async (id: string) => {
      try {
        await toggleCustomTodo(id);
        await refreshCustomTodos();
        void sendTodoItemComplete("custom");
      } catch (error) {
        captureErrorLog("Failed to toggle todo:", error);
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
        const deletionToastId = `todo-deleted-${id}`;

        toast.success("할 일이 삭제되었습니다.", {
          id: deletionToastId,
          action: createElement("button", {
            type: "button",
            "aria-label": "삭제 알림 닫기",
            className:
              "absolute inset-0 cursor-pointer rounded-[inherit] bg-transparent",
            onClick: () => toast.dismiss(deletionToastId),
          }),
        });
      } catch (error) {
        captureErrorLog("Failed to delete todo:", error);
        toast.error("삭제에 실패했습니다.");
      }
    },
    [refreshCustomTodos],
  );

  const handleTodoAdded = useCallback(() => {
    void refreshCustomTodos().catch((error) => {
      captureErrorLog("Failed to refresh custom todos after add:", error);
    });
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
        captureErrorLog("Failed to navigate to lecture:", error);
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
