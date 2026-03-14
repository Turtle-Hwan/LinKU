import { useState, useEffect, useCallback, useMemo } from "react";
import { eCampusGoLectureAPI, LOCAL_SAMPLE_LECTURE_URL } from "@/apis";
import { TodoItem as TodoItemType, ECampusTodoItem, CustomTodoItem } from "@/types/todo";
import {
  getCustomTodos,
  deleteCustomTodo,
  toggleCustomTodo,
} from "@/utils/todo/customTodo";
import { syncTodoCount } from "@/utils/todo/count";
import { getTodoDeadline } from "@/utils/todo/dateFormat";
import { useECampusAuth } from "@/hooks/useECampusAuth";
import { useTodoSettings } from "@/hooks/useTodoSettings";
import TodoItem from "./TodoItem";
import TodoControlBar from "./TodoControlBar";
import LoginDialog from "./LoginDialog";
import { toast } from "sonner";
import KUGoodjob from "@/assets/KU_goodjob.png";

const TodoList = () => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [ecampusTodos, setECampusTodos] = useState<ECampusTodoItem[]>([]);
  const [customTodos, setCustomTodos] = useState<CustomTodoItem[]>([]);
  const [error, setError] = useState("");

  // Custom hooks
  const { showLoginModal, setShowLoginModal, fetchTodoList, tryAutoLogin } = useECampusAuth();
  const { sortMethod, filterMode, timerEnabled, toggleSortMethod, toggleFilterMode } = useTodoSettings();

  // Sorted & filtered todos
  const allTodos: TodoItemType[] = useMemo(() => {
    const combined = [...ecampusTodos, ...customTodos];

    // Filter: hide completed custom todos when filterMode is 'incomplete'
    const filtered = filterMode === 'incomplete'
      ? combined.filter(todo => todo.type === 'ecampus' || !todo.completed)
      : combined;

    // Sort by deadline
    return filtered.sort((a, b) => {
      const deadlineA = getTodoDeadline(a);
      const deadlineB = getTodoDeadline(b);
      return sortMethod === 'dday-asc'
        ? deadlineA.getTime() - deadlineB.getTime()
        : deadlineB.getTime() - deadlineA.getTime();
    });
  }, [ecampusTodos, customTodos, sortMethod, filterMode]);

  // Load custom todos
  const loadCustomTodos = useCallback(async () => {
    try {
      const todos = await getCustomTodos();
      setCustomTodos(todos);
    } catch (error) {
      console.error("Error loading custom todos:", error);
    }
  }, []);

  // Load all todos (eCampus + Custom)
  const loadTodoList = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      // Load custom todos first (no login required)
      await loadCustomTodos();

      // Try auto-login for eCampus todos
      const result = await tryAutoLogin();
      if (result.success) {
        setECampusTodos(result.todos);
      } else {
        // If auto-login failed, try fetching without login
        const fetchResult = await fetchTodoList();
        if (fetchResult.success) {
          setECampusTodos(fetchResult.todos);
        }
      }
    } catch (error) {
      console.error("Error loading todo list:", error);
      setError("Todo 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [loadCustomTodos, tryAutoLogin, fetchTodoList]);

  // Update todo count in storage (eCampus + incomplete custom)
  useEffect(() => {
    void syncTodoCount({
      ecampusTodos,
      customTodos,
    });
  }, [ecampusTodos, customTodos]);

  // Initial load
  useEffect(() => {
    loadTodoList();
  }, [loadTodoList]);

  // Handlers
  const handleToggleTodo = async (id: string) => {
    try {
      await toggleCustomTodo(id);
      await loadCustomTodos();
    } catch (error) {
      console.error("Failed to toggle todo:", error);
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteCustomTodo(id);
      await loadCustomTodos();
      toast.success("할 일이 삭제되었습니다.");
    } catch (error) {
      console.error("Failed to delete todo:", error);
      toast.error("삭제에 실패했습니다.");
    }
  };

  const handleTodoAdded = () => {
    loadCustomTodos();
  };

  const handleTodoItemClick = async (
    kj: string,
    seq: string,
    gubun: string
  ) => {
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
      console.error("Failed to navigate to lecture:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Render
  return (
    <div
      id="todolist"
      className="p-4 border-t overflow-y-auto h-[500px]"
      style={{ scrollbarWidth: "thin" }}
    >
      <LoginDialog
        isOpen={showLoginModal}
        onOpenChange={setShowLoginModal}
        onLoginSuccess={async () => {
          const result = await fetchTodoList();
          if (result.success) {
            setECampusTodos(result.todos);
            setShowLoginModal(false);
          }
          return result.success;
        }}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        error={error}
        setError={setError}
      />

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="flex justify-center items-center py-8">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Control bar */}
          <TodoControlBar
            sortMethod={sortMethod}
            filterMode={filterMode}
            todoItems={allTodos}
            onSortMethodChange={toggleSortMethod}
            onFilterModeChange={toggleFilterMode}
            onTodoAdded={handleTodoAdded}
          />

          {/* Todo list or empty state */}
          {allTodos.length > 0 ? (
            allTodos.map((item) => (
              <TodoItem
                key={item.id}
                todo={item}
                timerEnabled={timerEnabled}
                onToggle={item.type === 'custom' ? handleToggleTodo : undefined}
                onDelete={item.type === 'custom' ? handleDeleteTodo : undefined}
                onClick={
                  item.type === 'ecampus'
                    ? () => handleTodoItemClick(item.kj, item.seq, item.gubun)
                    : undefined
                }
              />
            ))
          ) : (
            <div className="text-base text-center text-muted-foreground space-y-4">
              <p>할 일이 없습니다</p>
              <img src={KUGoodjob} alt="KU Good job" className="w-32 h-32 mx-auto" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TodoList;
