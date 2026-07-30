import { useEffect, useState } from "react";

import { eCampusLoginAPI, type ECampusLoginResponse } from "@/apis";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { saveECampusCredentials } from "@/utils/credentials";
import { errorLog } from "@/utils/logger";

interface LoginDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => Promise<string | null>;
}

const LoginDialog = ({
  isOpen,
  onOpenChange,
  onLoginSuccess,
}: LoginDialogProps) => {
  const [userId, setUserId] = useState("");
  const [userPw, setUserPw] = useState("");
  const [rememberLogin, setRememberLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setError("");
    }
  }, [isOpen]);

  const handleLogin = async () => {
    if (!userId || !userPw) {
      setError("ID와 비밀번호를 모두 입력해주세요.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const loginResult: ECampusLoginResponse = await eCampusLoginAPI(
        userId,
        userPw,
      );

      if (!loginResult.success) {
        setError(
          loginResult.data?.message ??
            "로그인에 실패했습니다. 인증 정보를 확인해주세요.",
        );
        return;
      }

      if (rememberLogin) {
        try {
          await saveECampusCredentials(userId, userPw);
        } catch (saveError) {
          errorLog("Failed to save credentials:", saveError);
        }
      }

      const loadError = await onLoginSuccess();
      if (loadError) {
        setError(loadError);
        return;
      }

      onOpenChange(false);
    } catch (loginError) {
      errorLog("Login error:", loginError);
      setError("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>eCampus 로그인</DialogTitle>
          <DialogDescription>
            아이디와 비밀번호를 입력하여 eCampus에 로그인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="userId" className="text-sm font-medium">
              아이디
            </label>
            <Input
              id="userId"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="아이디 입력"
              onKeyDown={(event) =>
                event.key === "Enter" && void handleLogin()
              }
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
              onChange={(event) => setUserPw(event.target.value)}
              placeholder="비밀번호 입력"
              onKeyDown={(event) =>
                event.key === "Enter" && void handleLogin()
              }
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="rememberLogin"
              type="checkbox"
              className="h-4 w-4 mr-2 text-primary border-gray-300 rounded focus:ring-primary"
              checked={rememberLogin}
              onChange={(event) => setRememberLogin(event.target.checked)}
            />
            <label htmlFor="rememberLogin" className="text-sm font-medium">
              로그인 상태 유지
            </label>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={() => void handleLogin()} disabled={isSubmitting}>
            {isSubmitting ? "로그인 중..." : "로그인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
