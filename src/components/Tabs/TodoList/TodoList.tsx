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

  // Save todo count to Chrome storage
  const saveTodoCount = useCallback((count: number) => {
    chrome.storage.local.set({ todoCount: count });
  }, []);

  // Todo 목록을 가져오는 함수
  const fetchTodoList = useCallback(async (): Promise<boolean> => {
    try {
      const result: ECampusTodoResponse = await eCampusTodoListAPI();

      if (result.success && result.data?.todoList) {
        setTodoItems(result.data.todoList);
        // Save todo count to storage
        saveTodoCount(result.data.todoList.length);
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
  }, [saveTodoCount]);

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
                <div className="text-sm font-semibold mb-1 flex items-center justify-between">
                  <p className="">{item.title}</p>
                  <span className="shrink-0 px-2 py-1 bg-main/10 text-main rounded-full">
                    {item.dDay === "D-1" || item.dDay === "D-Day" ? (
                      <CountdownTimer dueDate={item.dueDate} />
                    ) : (
                      item.dDay
                    )}
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

// 마감 시간 카운트다운 컴포넌트
const CountdownTimer = ({ dueDate }: { dueDate: string }) => {
  const [remainingTime, setRemainingTime] = useState<string>("");

  useEffect(() => {
    // 마감일 문자열 파싱
    const parseDueDate = (dueDateStr: string): Date => {
      // "2025.05.07 오후 1:00" 형식 파싱
      const parts = dueDateStr.split(" ");
      const datePart = parts[0]; // "2025.05.07"
      const amPm = parts[1]; // "오후"
      const timePart = parts[2]; // "1:00"

      const [year, month, day] = datePart
        .split(".")
        .map((num) => parseInt(num));

      console.log(datePart, amPm, timePart); // 디버깅용

      const [hourStr, minuteStr] = timePart.split(":");
      let hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);

      // 오후인 경우 12를 더함 (단, 오후 12시는 제외)
      if (amPm === "오후" && hour < 12) {
        hour += 12;
      }
      // 오전 12시는 0시로 변환
      if (amPm === "오전" && hour === 12) {
        hour = 0;
      }

      return new Date(year, month - 1, day, hour, minute);
    };

    // 남은 시간 계산 함수
    const calculateTimeRemaining = () => {
      const targetDate = parseDueDate(dueDate);
      const now = new Date();

      // 남은 시간 (밀리초)
      const diff = targetDate.getTime() - now.getTime();
      console.log("남은 시간:", diff); // 디버깅용

      if (diff <= 0) {
        setRemainingTime("마감");
        return false; // 타이머 중지
      }

      // 시, 분, 초 계산
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // HH:MM:SS 포맷
      setRemainingTime(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );

      return true; // 타이머 계속 실행
    };

    // 초기 계산
    const shouldContinue = calculateTimeRemaining();
    console.log("shouldContinue:", shouldContinue); // 디버깅용

    // 1초마다 업데이트
    let intervalId: number | null = null;
    if (shouldContinue) {
      intervalId = window.setInterval(calculateTimeRemaining, 1000);
    }

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [dueDate]);

  return <span className="text-rose-600 font-mono">{remainingTime}</span>;
};

export default TodoList;
