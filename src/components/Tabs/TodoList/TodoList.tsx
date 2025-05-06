import { useState, useEffect, useCallback } from "react";
import {
  eCampusTodoListAPI,
  eCampusGoLectureAPI,
  eCampusLoginAPI,
  ECampusTodoResponse,
  TodoItem,
} from "@/apis/eCampusAPI";
import LoginDialog from "./LoginDialog";

const TodoList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [error, setError] = useState("");

  // Todo 목록을 가져오는 함수
  const fetchTodoList = useCallback(async (): Promise<boolean> => {
    try {
      const result: ECampusTodoResponse = await eCampusTodoListAPI();

      if (result.success && result.data?.todoList) {
        setTodoItems(result.data.todoList);
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
  }, []);

  // 저장된 인증 정보로 로그인 시도
  const tryLoginWithSavedCredentials =
    useCallback(async (): Promise<boolean> => {
      return new Promise((resolve) => {
        chrome.storage.local.get("credentials", async (data) => {
          const credentials = data.credentials;

          if (!credentials?.id || !credentials?.password) {
            resolve(false);
            return;
          }

          try {
            const loginResult = await eCampusLoginAPI(
              credentials.id,
              credentials.password
            );

            if (loginResult.success) {
              const todoFetched = await fetchTodoList();
              resolve(todoFetched);
            } else {
              resolve(false);
            }
          } catch (error) {
            console.error("Error with saved credentials:", error);
            resolve(false);
          }
        });
      });
    }, [fetchTodoList]);

  // 전체 Todo 로드 프로세스
  const loadTodoList = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      // 1. 먼저 Todo 목록 요청 시도
      const todoFetched = await fetchTodoList();

      // 2. 성공하면 완료
      if (todoFetched) {
        setIsLoading(false);
        return;
      }

      // 3. 실패하면 저장된 인증 정보로 로그인 시도
      const loggedInWithSaved = await tryLoginWithSavedCredentials();

      // 4. 저장된 인증으로도 실패하면 로그인 모달 표시
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
  }, [fetchTodoList, tryLoginWithSavedCredentials]);

  // 초기 로드 시 Todo 목록 가져오기
  useEffect(() => {
    loadTodoList();
  }, [loadTodoList]);

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
          {todoItems.length > 0 ? (
            todoItems.map((item) => (
              <div
                key={item.id}
                className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  handleTodoItemClick(item.kj, item.seq, item.gubun)
                }
              >
                <div className="text-sm mb-1 flex items-center justify-between">
                  <p className="font-semibold">{item.title}</p>
                  <span className="font-extrabold px-2 py-1 bg-main/10 text-main rounded-full">
                    {item.dDay}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{item.subject}</p>
                <p className="text-xs text-gray-600 mt-1">{item.dueDate}</p>
              </div>
            ))
          ) : (
            <p className="text-base text-center text-muted-foreground">
              할 일이 없습니다.
            </p>
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
