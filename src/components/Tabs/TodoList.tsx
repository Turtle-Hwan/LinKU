import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { eCampusLoginAPI, eCampusTodoListAPI } from "@/apis/eCampusAPI";

const TodoList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [todoItems, setTodoItems] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userId, setUserId] = useState("");
  const [userPw, setUserPw] = useState("");
  const [error, setError] = useState("");

  // 초기 로드 시 Todo 목록 가져오기
  useEffect(() => {
    loadTodoList();
  }, []);

  // Todo 목록 로드 함수
  async function loadTodoList() {
    setIsLoading(true);

    try {
      // 먼저 Todo 목록 요청 시도
      const result = await eCampusTodoListAPI();

      if (result.success) {
        console.log(result);
        setTodoItems(result.data.todoList || []);
      } else if (result.needLogin) {
        // 로그인이 필요한 경우, 저장된 인증 정보 확인
        chrome.storage.local.get("credentials", async (data) => {
          const credentials = data.credentials;

          if (credentials?.id && credentials?.password) {
            // 저장된 인증 정보로 로그인 시도
            const loginResult = await eCampusLoginAPI(
              credentials.id,
              credentials.password
            );

            if (loginResult.success) {
              // 로그인 성공 후 다시 Todo 목록 요청
              const todoResult = await eCampusTodoListAPI();
              if (todoResult.success) {
                setTodoItems(todoResult.data.todoList || []);
              } else {
                // 인증 실패 시 모달 표시
                setShowLoginModal(true);
              }
            } else {
              // 로그인 실패 시 모달 표시
              setShowLoginModal(true);
            }
          } else {
            // 저장된 인증 정보가 없으면 로그인 모달 표시
            setShowLoginModal(true);
          }
          setIsLoading(false);
        });
        return; // 비동기 처리를 위해 여기서 함수 종료
      }
    } catch (error) {
      console.error("Error loading todo list:", error);
      setShowLoginModal(true);
    }

    setIsLoading(false);
  }

  // 로그인 처리
  async function handleLogin() {
    if (!userId || !userPw) {
      setError("ID와 비밀번호를 모두 입력해주세요.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // 로그인 시도
      const loginResult = await eCampusLoginAPI(userId, userPw);

      if (loginResult.success) {
        // 인증 정보 저장
        chrome.storage.local.set({
          credentials: { id: userId, password: userPw },
        });

        // 로그인 모달 닫기
        setShowLoginModal(false);

        // Todo 목록 다시 로드
        const todoResult = await eCampusTodoListAPI();
        if (todoResult.success) {
          setTodoItems(todoResult.data.todoList || []);
        }
      } else {
        setError("로그인에 실패했습니다. 인증 정보를 확인해주세요.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Todo List</h2>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {todoItems.length > 0 ? (
            todoItems.map((item, index) => (
              <div key={index} className="p-3 border rounded-md">
                {/* <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.dueDate}</p> */}
                <p>{item}</p>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground">
              할 일이 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 간단한 로그인 모달 */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이캠퍼스 로그인</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
                학번/아이디
              </label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="학번 또는 아이디 입력"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="userPw" className="text-sm font-medium">
                비밀번호
              </label>
              <Input
                id="userPw"
                type="password"
                value={userPw}
                onChange={(e) => setUserPw(e.target.value)}
                placeholder="비밀번호 입력"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleLogin} disabled={isLoading}>
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TodoList;
