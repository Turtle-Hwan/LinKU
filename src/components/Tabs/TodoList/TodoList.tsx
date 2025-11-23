import { useState, useEffect, useCallback, useMemo } from "react";
import {
  eCampusTodoListAPI,
  eCampusGoLectureAPI,
  eCampusLoginAPI,
  ECampusTodoResponse,
} from "@/apis";
import { TodoItem as TodoItemType, ECampusTodoItem } from "@/types/todo";
import { getStorage, setStorage } from "@/utils/chrome";
import { loadECampusCredentials } from "@/utils/credentials";
import {
  getCustomTodos,
  deleteCustomTodo,
  toggleCustomTodo,
} from "@/utils/todo/customTodo";
import TodoItem from "./TodoItem";
import TodoAddButton from "./TodoAddButton";
import LoginDialog from "./LoginDialog";
import TodoExportButton from "./TodoExportButton";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import KUGoodjob from "@/assets/KU_goodjob.png";

type SortMethod = 'dday-asc' | 'dday-desc';

const SORT_METHOD_KEY = "todoSortMethod";

/**
 * D-Day 문자열을 숫자로 변환
 * "D-3" → -3, "D-Day" → 0, "D+2" → 2
 */
function parseDDay(dDay: string): number {
  if (dDay === "D-Day") return 0;

  const match = dDay.match(/D([+-])(\d+)/);
  if (!match) return 0;

  const sign = match[1] === '+' ? 1 : -1;
  const value = parseInt(match[2], 10);

  return sign * value;
}

const TodoList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [ecampusTodos, setECampusTodos] = useState<ECampusTodoItem[]>([]);
  const [customTodos, setCustomTodos] = useState<TodoItemType[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [error, setError] = useState("");
  const [sortMethod, setSortMethod] = useState<SortMethod>('dday-desc');

  // 정렬 방식에 따라 전체 Todo 목록 정렬
  const allTodos: TodoItemType[] = useMemo(() => {
    const combined = [...ecampusTodos, ...customTodos];

    return combined.sort((a, b) => {
      if (sortMethod === 'dday-asc') {
        // D-Day 오름차순: 가장 적게 남은 것부터
        return parseDDay(a.dDay) - parseDDay(b.dDay);
      } else {
        // D-Day 내림차순: 가장 많이 남은 것부터
        return parseDDay(b.dDay) - parseDDay(a.dDay);
      }
    });
  }, [ecampusTodos, customTodos, sortMethod]);

  // Save todo count to Chrome storage
  const saveTodoCount = useCallback(async (count: number) => {
    await setStorage({ todoCount: count });
  }, []);

  // 사용자 정의 Todo 불러오기
  const loadCustomTodos = useCallback(async () => {
    try {
      const todos = await getCustomTodos();
      setCustomTodos(todos);
    } catch (error) {
      console.error("Error loading custom todos:", error);
    }
  }, []);

  // 이캠퍼스 Todo 목록을 가져오는 함수
  const fetchTodoList = useCallback(async (): Promise<boolean> => {
    try {
      const result: ECampusTodoResponse = await eCampusTodoListAPI();

      if (result.success && result.data?.todoList) {
        setECampusTodos(result.data.todoList);
        // Save todo count to storage (이캠퍼스 + 사용자 정의)
        saveTodoCount(result.data.todoList.length + customTodos.length);
        return true;
      }

      if (result.needLogin) {
        setError("로그인이 필요합니다.");
        return false; // 로그인 필요
      }

      setError("Todo 목록을 불러오는데 실패했습니다.");
      return false;
    } catch (error) {
      console.error("Error fetching todo list:", error);
      setError("Todo 목록을 불러오는 중 오류가 발생했습니다.");
      return false;
    }
  }, [saveTodoCount, customTodos.length]);

  // 저장된 인증 정보로 로그인 시도
  const tryLoginWithSavedCredentials = useCallback(async (): Promise<boolean> => {
    try {
      const credentials = await loadECampusCredentials();

      if (!credentials) {
        return false;
      }

      const loginResult = await eCampusLoginAPI(
        credentials.id,
        credentials.password
      );

      if (loginResult.success) {
        const todoFetched = await fetchTodoList();
        return todoFetched;
      }

      return false;
    } catch (error) {
      console.error("Error with saved credentials:", error);
      return false;
    }
  }, [fetchTodoList]);

  // 전체 Todo 로드 프로세스
  const loadTodoList = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      // 1. 사용자 정의 Todo 먼저 불러오기 (로그인 불필요)
      await loadCustomTodos();

      // 2. 이캠퍼스 Todo 목록 요청 시도
      const todoFetched = await fetchTodoList();

      // 3. 성공하면 완료
      if (todoFetched) {
        setIsLoading(false);
        return;
      }

      // 4. 실패하면 저장된 인증 정보로 로그인 시도
      const loggedInWithSaved = await tryLoginWithSavedCredentials();

      // 5. 저장된 인증으로도 실패하면 로그인 모달 표시
      if (!loggedInWithSaved) {
        setShowLoginModal(true);
      }
    } catch (error) {
      console.error("Error loading todo list:", error);
      setError("오류가 발생했습니다. 다시 시도해주세요.");
      setShowLoginModal(true);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTodoList, tryLoginWithSavedCredentials, loadCustomTodos]);

  // 초기 로드 시 Todo 목록 가져오기
  useEffect(() => {
    loadTodoList();
  }, [loadTodoList]);

  // 정렬 방식 불러오기
  useEffect(() => {
    const loadSortMethod = async () => {
      const savedMethod = await getStorage<SortMethod>(SORT_METHOD_KEY);
      if (savedMethod) {
        setSortMethod(savedMethod);
      }
    };
    loadSortMethod();
  }, []);

  // 정렬 방식 변경 및 저장
  const handleSortMethodChange = async () => {
    const nextMethod: SortMethod =
      sortMethod === 'dday-asc' ? 'dday-desc' : 'dday-asc';

    setSortMethod(nextMethod);
    await setStorage({ [SORT_METHOD_KEY]: nextMethod });
  };

  // 사용자 정의 Todo 완료 상태 토글
  const handleToggleTodo = async (id: string) => {
    try {
      await toggleCustomTodo(id);
      await loadCustomTodos();
    } catch (error) {
      console.error("Failed to toggle todo:", error);
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  // 사용자 정의 Todo 삭제
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

  // Todo 추가 성공 시 목록 새로고침
  const handleTodoAdded = () => {
    loadCustomTodos();
  };

  // Todo 항목 클릭 처리
  const handleTodoItemClick = async (
    seq: string,
    kj: string,
    gubun: string
  ) => {
    try {
      setIsLoading(true);
      const result = await eCampusGoLectureAPI(seq, kj, gubun);

      if (result.success) {
        // 성공 시 해당 URL로 이동 (이캠퍼스 페이지 열기)
        const lectureUrl = `https://ecampus.konkuk.ac.kr${result.message}`;
        window.open(lectureUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to navigate to lecture:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="todolist"
      className="p-4 border-t overflow-y-auto h-[500px]"
      style={{ scrollbarWidth: "thin" }}
    >
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {allTodos.length > 0 ? (
            <>
              <div className="flex justify-between items-center gap-2">
                <TodoAddButton onSuccess={handleTodoAdded} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSortMethodChange}
                    className="gap-1.5"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {sortMethod === 'dday-asc' ? '오름차순' : '내림차순'}
                  </Button>
                  <TodoExportButton todoItems={allTodos} />
                </div>
              </div>
              {allTodos.map((item) => (
                <TodoItem
                  key={item.id}
                  todo={item}
                  onToggle={item.type === 'custom' ? handleToggleTodo : undefined}
                  onDelete={item.type === 'custom' ? handleDeleteTodo : undefined}
                  onClick={
                    item.type === 'ecampus'
                      ? () => handleTodoItemClick(item.kj, item.seq, item.gubun)
                      : undefined
                  }
                />
              ))}
            </>
          ) : (
            <div className="text-base text-center text-muted-foreground space-y-4">
              <p>할 일이 없습니다</p>
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={KUGoodjob}
                    alt="KU Good Job"
                    width={160}
                    height={160}
                  />

                  {/* TODO : 둥근 텍스트 - 위쪽 부채꼴 영역에만 // 넣어보려 했으나 생각보다 시간이 많이 걸리는 관계로 다음 기회에.. */}
                  {/* <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      <defs>
                        <path
                          d="M 5,90 A 90,90 0 0,1 190,95"
                          id="text-circle-top"
                        />
                      </defs>
                      <text fontFamily="BMJUA" className="fill-main text-base">
                        <textPath href="#text-circle-top" startOffset="30%">
                          참 잘 했 다 KU !
                        </textPath>
                      </text>
                    </svg>
                  </div> */}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 로그인 모달 컴포넌트 */}
      <LoginDialog
        isOpen={showLoginModal}
        onOpenChange={setShowLoginModal}
        onLoginSuccess={fetchTodoList}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        error={error}
        setError={setError}
      />
    </div>
  );
};

export default TodoList;
