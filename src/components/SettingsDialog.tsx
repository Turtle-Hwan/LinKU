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
import { sendSettingChange, sendButtonClick } from "@/utils/analytics";
import { encryptPassword, decryptPassword } from "@/utils/crypto";
import { getStorage, setStorage, removeStorage } from "@/utils/chrome";
import { eCampusLoginAPI } from "@/apis/eCampusAPI";
import { Info } from "lucide-react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ECampusCredential = () => {
  const [savedId, setSavedId] = useState<string>("");
  const [savedPassword, setSavedPassword] = useState<string>("");
  const [hasCredentials, setHasCredentials] = useState<boolean>(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  // 설정 페이지 열릴 때 저장된 계정 정보 불러오기
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // 저장된 인증 정보 불러오기
  const loadSavedCredentials = async () => {
    try {
      const credentials = await getStorage<{ id: string; password: string }>("credentials");

      if (!credentials?.id || !credentials?.password) {
        setSavedId("");
        setSavedPassword("");
        setHasCredentials(false);
        return;
      }

      setSavedId(credentials.id);

      // 복호화 시도 (실패 시 평문으로 처리 - 이전 데이터 호환성)
      try {
        const decryptedPassword = await decryptPassword(credentials.password);
        setSavedPassword(decryptedPassword);
      } catch {
        setSavedPassword(credentials.password);
      }

      setHasCredentials(true);
    } catch (error) {
      console.error("[Settings] Load credentials error:", error);
      toast.error("인증 정보를 불러오는데 실패했습니다.");
    }
  };

  // 인증 정보 저장하기
  const saveCredentials = async () => {
    if (!savedId || !savedPassword) {
      toast.error("ID와 비밀번호를 모두 입력해주세요.");
      return;
    }

    try {
      // 1. 암호화 및 저장
      const encryptedPassword = await encryptPassword(savedPassword);
      await setStorage({
        credentials: { id: savedId, password: encryptedPassword },
      });

      setHasCredentials(true);
      sendSettingChange("credentials", "saved");
      toast.success("인증 정보가 저장되었습니다.");

      // 2. 로그인 검증 (백그라운드)
      const loginResult = await eCampusLoginAPI(savedId, savedPassword);

      // 2-1. 검증 결과 별도 toast
      if (loginResult.success) {
        toast.success("eCampus 로그인 성공");
      } else {
        toast.error("eCampus 로그인 실패");
      }
    } catch (error) {
      console.error("[Settings] Save credentials error:", error);
      toast.error("인증 정보 저장에 실패했습니다.");
    }
  };

  // 인증 정보 삭제하기
  const deleteCredentials = async () => {
    if (!confirm("저장된 인증 정보를 삭제하시겠습니까?")) return;

    try {
      await removeStorage("credentials");
      setSavedId("");
      setSavedPassword("");
      setHasCredentials(false);
      sendSettingChange("credentials", "deleted");
      toast.success("인증 정보가 삭제되었습니다.");
    } catch (error) {
      console.error("[Settings] Delete credentials error:", error);
      toast.error("인증 정보 삭제에 실패했습니다.");
    }
  };

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-base font-semibold">이캠퍼스 계정 관리</h2>

        <div className="space-y-3">
          <div className="space-y-1.5">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  sendButtonClick("password_toggle", "settings_dialog");
                  setIsPasswordVisible(!isPasswordVisible);
                }}
              >
                {isPasswordVisible ? "숨기기" : "보기"}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              ID/PW는 외부 서버에 저장되지 않으며, AES-GCM 256으로 암호화되어 브라우저에만 보관됩니다.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-row gap-2 space-x-0">
        <Button
          variant="outline"
          onClick={deleteCredentials}
          disabled={!hasCredentials}
          className="flex-1"
        >
          삭제
        </Button>
        <Button onClick={saveCredentials} className="flex-1">
          저장
        </Button>
      </div>
    </>
  );
};

const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription className="hidden">설정</DialogDescription>
        </DialogHeader>

        <SettingsDialog.ECampusCredential />

        <DialogFooter className="flex flex-row gap-2 space-x-0" />
      </DialogContent>
    </Dialog>
  );
};

SettingsDialog.ECampusCredential = ECampusCredential;

export default SettingsDialog;
