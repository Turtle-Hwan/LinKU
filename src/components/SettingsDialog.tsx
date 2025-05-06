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
import { DialogDescription } from "@radix-ui/react-dialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const [savedId, setSavedId] = useState<string>("");
  const [savedPassword, setSavedPassword] = useState<string>("");
  const [hasCredentials, setHasCredentials] = useState<boolean>(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  // 설정 페이지 열릴 때 저장된 계정 정보 불러오기
  useEffect(() => {
    if (open) {
      loadSavedCredentials();
    }
  }, [open]);

  // 저장된 인증 정보 불러오기
  const loadSavedCredentials = () => {
    chrome.storage.local.get("credentials", (data) => {
      const credentials = data.credentials;
      if (credentials?.id && credentials?.password) {
        setSavedId(credentials.id);
        setSavedPassword(credentials.password);
        setHasCredentials(true);
      } else {
        setSavedId("");
        setSavedPassword("");
        setHasCredentials(false);
      }
    });
  };

  // 인증 정보 저장하기
  const saveCredentials = () => {
    if (savedId && savedPassword) {
      chrome.storage.local.set({
        credentials: { id: savedId, password: savedPassword },
      });
      setHasCredentials(true);
      alert("인증 정보가 저장되었습니다.");
    } else {
      alert("ID와 비밀번호를 모두 입력해주세요.");
    }
  };

  // 인증 정보 삭제하기
  const deleteCredentials = () => {
    if (confirm("저장된 인증 정보를 삭제하시겠습니까?")) {
      chrome.storage.local.remove("credentials");
      setSavedId("");
      setSavedPassword("");
      setHasCredentials(false);
      alert("인증 정보가 삭제되었습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription className="hidden">설정</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-md font-medium">이캠퍼스 계정 관리</h3>
            <p className="text-sm text-muted-foreground">
              {hasCredentials
                ? "저장된 계정 정보가 있습니다."
                : "저장된 계정 정보가 없습니다."}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="savedId" className="text-sm font-medium">
              아이디
            </label>
            <Input
              id="savedId"
              value={savedId}
              onChange={(e) => setSavedId(e.target.value)}
              placeholder="아이디 입력"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="savedPassword" className="text-sm font-medium">
              비밀번호
            </label>
            <div className="relative">
              <Input
                id="savedPassword"
                type={isPasswordVisible ? "text" : "password"}
                value={savedPassword}
                onChange={(e) => setSavedPassword(e.target.value)}
                placeholder="비밀번호 입력"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground"
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                {isPasswordVisible ? "숨기기" : "보기"}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end">
          <Button
            variant="destructive"
            onClick={deleteCredentials}
            disabled={!hasCredentials}
          >
            삭제
          </Button>
          <Button onClick={saveCredentials}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
