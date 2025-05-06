import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { eCampusLoginAPI, ECampusLoginResponse } from "@/apis/eCampusAPI";

interface LoginDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => Promise<boolean>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string;
  setError: (error: string) => void;
}

const LoginDialog = ({
  isOpen,
  onOpenChange,
  onLoginSuccess,
  isLoading,
  setIsLoading,
  error,
  setError,
}: LoginDialogProps) => {
  const [userId, setUserId] = useState("");
  const [userPw, setUserPw] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);

  // 사용자 입력으로 로그인 처리
  const handleLogin = async () => {
    if (!userId || !userPw) {
      setError("ID와 비밀번호를 모두 입력해주세요.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // 로그인 시도
      const loginResult: ECampusLoginResponse = await eCampusLoginAPI(
        userId,
        userPw
      );

      if (loginResult.success) {
        // 인증 정보 저장 (rememberLogin이 true일 때만)
        if (rememberLogin) {
          chrome.storage.local.set({
            credentials: { id: userId, password: userPw },
          });
        }

        // 로그인 모달 닫기
        onOpenChange(false);

        // Todo 목록 다시 로드
        await onLoginSuccess();
      } else {
        // 실패 메시지 표시 - 서버 메시지 사용
        const errorMsg =
          loginResult.data?.message ||
          "로그인에 실패했습니다. 인증 정보를 확인해주세요.";
        setError(errorMsg);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="rememberLogin"
              type="checkbox"
              className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
            />
            <label htmlFor="rememberLogin" className="text-sm font-medium">
              로그인 상태 유지
            </label>
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
  );
};

export default LoginDialog;
