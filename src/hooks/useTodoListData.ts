import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { eCampusGoLectureAPI, LOCAL_SAMPLE_LECTURE_URL } from "@/apis";
import type { CustomTodoItem, ECampusTodoItem, TodoItem } from "@/types/todo";
import {
  deleteCustomTodo,
  getCustomTodos,
  toggleCustomTodo,
} from "@/utils/todo/customTodo";
import { getTodoDeadline } from "@/utils/todo/dateFormat";
import { useECampusAuth } from "@/hooks/useECampusAuth";
import { useTodoSettings } from "@/hooks/useTodoSettings";
import {
  sendTodoItemComplete,
  sendTodoItemDelete,
  sendTodoView,
} from "@/utils/analytics";
import { errorLog } from "@/utils/logger";
import { toast } from "sonner";

export function useTodoListData() {
  const viewOpenSentRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ecampusTodos, setECampusTodos] = useState<ECampusTodoItem[]>([]);
  const [customTodos, setCustomTodos] = useState<CustomTodoItem[]>([]);
  const [error, setError] = useState("");

  const { showLoginModal, setShowLoginModal, loadECampusTodos } = useECampusAuth();
  const {
    sortMethod,
    filterMode,
    timerEnabled,
    toggleSortMethod,
    toggleFilterMode,
  } = useTodoSettings();

  const allTodos: TodoItem[] = useMemo(() => {
    const combined = [...ecampusTodos, ...customTodos];
    const filtered =
      filterMode === "incomplete"
        ? combined.filter((todo) => todo.type === "ecampus" || !todo.completed)
        : combined;

    return filtered.sort((a, b) => {
      const deadlineA = getTodoDeadline(a);
      const deadlineB = getTodoDeadline(b);

      return sortMethod === "dday-asc"
        ? deadlineA.getTime() - deadlineB.getTime()
        : deadlineB.getTime() - deadlineA.getTime();
    });
  }, [customTodos, ecampusTodos, filterMode, sortMethod]);

  const loadCustomTodos = useCallback(async () => {
    try {
      const todos = await getCustomTodos();
      setCustomTodos(todos);
      return todos;
    } catch (error) {
      errorLog("Error loading custom todos:", error);
      return [];
    }
  }, []);

  const loadTodoList = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      await loadCustomTodos();

      const result = await loadECampusTodos({
        allowAutoLogin: true,
        openLoginModal: true,
      });

      if (result.success) {
        setECampusTodos(result.todos);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (error) {
      errorLog("Error loading todo list:", error);
      setError("Todo 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [loadCustomTodos, loadECampusTodos]);

  useEffect(() => {
    void loadTodoList();
  }, [loadTodoList]);

  useEffect(() => {
    if (!isLoading && !viewOpenSentRef.current) {
      viewOpenSentRef.current = true;
      void sendTodoView(ecampusTodos.length + customTodos.length);
    }
  }, [customTodos.length, ecampusTodos.length, isLoading]);

  const handleLoginSuccess = useCallback(async () => {
    const result = await loadECampusTodos({
      allowAutoLogin: false,
      openLoginModal: false,
    });

    if (result.success) {
      setECampusTodos(result.todos);
      setShowLoginModal(false);
    } else if (result.error) {
      setError(result.error);
    }

    return result.success;
  }, [loadECampusTodos, setShowLoginModal]);

  const handleToggleTodo = useCallback(
    async (id: string) => {
      try {
        await toggleCustomTodo(id);
        await loadCustomTodos();
        void sendTodoItemComplete("custom");
      } catch (error) {
        errorLog("Failed to toggle todo:", error);
        toast.error("상태 변경에 실패했습니다.");
      }
    },
    [loadCustomTodos]
  );

  const handleDeleteTodo = useCallback(
    async (id: string) => {
      try {
        await deleteCustomTodo(id);
        await loadCustomTodos();
        void sendTodoItemDelete("custom");
        toast.success("할 일이 삭제되었습니다.");
      } catch (error) {
        errorLog("Failed to delete todo:", error);
        toast.error("삭제에 실패했습니다.");
      }
    },
    [loadCustomTodos]
  );

  const handleTodoAdded = useCallback(() => {
    void loadCustomTodos();
  }, [loadCustomTodos]);

  const handleTodoItemClick = useCallback(
    async (kj: string, seq: string, gubun: string) => {
      try {
        setIsLoading(true);
        const result = await eCampusGoLectureAPI(kj, seq, gubun);

        if (result.success && result.message === LOCAL_SAMPLE_LECTURE_URL) {
          toast.info("로컬 예시 eCampus 항목입니다. 실제 강의 페이지로는 이동하지 않습니다.");
        } else if (result.success && result.message) {
          const lectureUrl = `https://ecampus.konkuk.ac.kr${result.message}`;
          window.open(lectureUrl, "_blank");
        }
      } catch (error) {
        errorLog("Failed to navigate to lecture:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    allTodos,
    error,
    filterMode,
    handleDeleteTodo,
    handleLoginSuccess,
    handleTodoAdded,
    handleTodoItemClick,
    handleToggleTodo,
    isLoading,
    setError,
    setIsLoading,
    showLoginModal,
    setShowLoginModal,
    sortMethod,
    timerEnabled,
    toggleFilterMode,
    toggleSortMethod,
  };
}
