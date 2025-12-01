import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DialogDescription } from "@radix-ui/react-dialog";
import { sendSettingChange, sendButtonClick } from "@/utils/analytics";
import {
  saveECampusCredentials,
  loadECampusCredentials,
  clearECampusCredentials,
} from "@/utils/credentials";
import {
  startGoogleLogin,
  logout,
  isLoggedIn,
  getUserProfile,
  isGuestUser,
  UserProfile,
} from "@/utils/oauth";
import { eCampusLoginAPI } from "@/apis";
import { Info, Palette, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { EmailVerificationDialog } from "@/components/EmailVerificationDialog";

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
      const credentials = await loadECampusCredentials();

      if (!credentials) {
        setSavedId("");
        setSavedPassword("");
        setHasCredentials(false);
        return;
      }

      setSavedId(credentials.id);
      setSavedPassword(credentials.password);
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
      await saveECampusCredentials(savedId, savedPassword);

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
      await clearECampusCredentials();
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

const GoogleOAuthSection = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showEmailVerification, setShowEmailVerification] = useState<boolean>(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  // Check login status on mount
  useEffect(() => {
    checkLoginStatus();
  }, []);

  // Listen for auth events
  useEffect(() => {
    const handleLogout = () => {
      setLoggedIn(false);
      setIsGuest(false);
      setUserProfile(null);
      setVerifiedEmail(null);
    };

    const handleUnauthorized = () => {
      setLoggedIn(false);
      setIsGuest(false);
      setUserProfile(null);
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const checkLoginStatus = async () => {
    const loggedIn = await isLoggedIn();
    setLoggedIn(loggedIn);

    if (loggedIn) {
      const guest = await isGuestUser();
      setIsGuest(guest);

      const profile = await getUserProfile();
      setUserProfile(profile);

      // Load verified email if exists
      const storage = await chrome.storage.local.get(['kuMail']);
      if (storage.kuMail) {
        setVerifiedEmail(storage.kuMail);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    sendButtonClick("google_login", "settings_dialog");

    try {
      const result = await startGoogleLogin();

      if (result.success) {
        setLoggedIn(true);

        // Check if this is a guest (requires signup)
        if (result.response.requiresSignup) {
          setIsGuest(true);
          // Auto-open email verification dialog for guests
          setShowEmailVerification(true);
          toast.info("건국대 이메일 인증이 필요합니다.");
        } else {
          setIsGuest(false);
          setUserProfile(result.response.profile);
          toast.success("로그인 성공!");
        }
      } else {
        toast.error("로그인 실패", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("오류", {
        description: "로그인 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Called after email verification is complete
  const handleVerificationComplete = async () => {
    // Re-login to get member token
    setIsLoading(true);
    try {
      const result = await startGoogleLogin();

      if (result.success && !result.response.requiresSignup) {
        setIsGuest(false);
        setUserProfile(result.response.profile);

        // Load verified email
        const storage = await chrome.storage.local.get(['kuMail']);
        if (storage.kuMail) {
          setVerifiedEmail(storage.kuMail);
        }

        toast.success("회원가입 완료!", {
          description: "이제 모든 기능을 사용할 수 있습니다.",
        });
      } else {
        // Still guest after re-login (edge case)
        toast.error("인증에 문제가 발생했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("Re-login error:", error);
      toast.error("재로그인에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    sendButtonClick("google_logout", "settings_dialog");

    await logout();
    setLoggedIn(false);
    setIsGuest(false);
    setUserProfile(null);
    setVerifiedEmail(null);

    toast.success("로그아웃 완료");
  };

  // Get initials for avatar fallback
  const getInitials = (name: string): string => {
    if (!name) return "??";
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!loggedIn) {
    // Not logged in - show login button
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Google 계정</h2>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Google 계정으로 로그인하면 템플릿을 서버에 저장하고 여러 기기에서 동기화할 수 있습니다.
            </p>
          </div>

          <Button
            onClick={handleGoogleLogin}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "로그인 중..." : "Google 로그인"}
          </Button>
        </div>
      </div>
    );
  }

  // Guest user - show email verification prompt
  if (isGuest) {
    return (
      <>
        <div className="space-y-4">
          <h2 className="text-base font-semibold">이메일 인증 필요</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <Mail className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                건국대학교 이메일 인증을 완료해야 템플릿 동기화 기능을 사용할 수 있습니다.
              </p>
            </div>

            <Button
              onClick={() => setShowEmailVerification(true)}
              className="w-full"
              disabled={isLoading}
            >
              <Mail className="h-4 w-4 mr-2" />
              건국대 이메일 인증하기
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full text-muted-foreground"
            >
              다른 계정으로 로그인
            </Button>
          </div>
        </div>

        <EmailVerificationDialog
          open={showEmailVerification}
          onOpenChange={setShowEmailVerification}
          onVerificationComplete={handleVerificationComplete}
        />
      </>
    );
  }

  // Logged in as member - show user profile
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Google 계정</h2>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={userProfile?.picture} alt={userProfile?.name} />
            <AvatarFallback>
              {userProfile ? getInitials(userProfile.name) : "??"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {userProfile?.name || "사용자"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {verifiedEmail || userProfile?.email || "인증된 사용자"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const TemplateEditorSection = () => {
  const handleOpenEditor = () => {
    sendButtonClick("open_template_editor", "settings_dialog");

    // 새 탭에서 템플릿 에디터 열기
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html#/editor')
    });

    toast.success("템플릿 에디터를 새 탭에서 열었습니다.");
  };

  const handleOpenTemplateList = () => {
    sendButtonClick("open_template_list", "settings_dialog");

    // 새 탭에서 템플릿 목록 열기
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html#/templates')
    });

    toast.success("템플릿 목록을 새 탭에서 열었습니다.");
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h2 className="text-base font-semibold">템플릿 관리</h2>

      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            템플릿 에디터에서 나만의 홈페이지 바로가기 레이아웃을 만들고 편집할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleOpenTemplateList}
            variant="outline"
          >
            내 템플릿 보기
          </Button>
          <Button
            onClick={handleOpenEditor}
            variant="outline"
          >
            <Palette className="h-4 w-4 mr-2" />
            새 템플릿 만들기
          </Button>
        </div>
      </div>
    </div>
  );
};

const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription className="hidden">설정</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="google" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="google">Google 계정</TabsTrigger>
            <TabsTrigger value="ecampus">eCampus 계정</TabsTrigger>
          </TabsList>

          <TabsContent value="google" className="space-y-4 mt-4">
            <SettingsDialog.GoogleOAuth />
            <div className="pt-4">
              <SettingsDialog.TemplateEditor />
            </div>
          </TabsContent>

          <TabsContent value="ecampus" className="space-y-4 mt-4">
            <SettingsDialog.ECampusCredential />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-row gap-2 space-x-0" />
      </DialogContent>
    </Dialog>
  );
};

SettingsDialog.GoogleOAuth = GoogleOAuthSection;
SettingsDialog.ECampusCredential = ECampusCredential;
SettingsDialog.TemplateEditor = TemplateEditorSection;

export default SettingsDialog;
