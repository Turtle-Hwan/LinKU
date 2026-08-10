import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import UtilityDialog from "@/components/UtilityDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { usePersistentDialogTab } from "@/hooks/usePersistentDialogTab";
import {
  sendButtonClick,
  sendAuthLoginStart,
  sendAuthLoginSuccess,
  sendAuthLoginFail,
  sendAuthLogout,
  sendSettingsCredentialsSaved,
  sendSettingsCredentialsDeleted,
  sendSettingChange,
} from "@/utils/analytics";
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
import {
  Info,
  Palette,
  LogOut,
  Mail,
  Settings as SettingsIcon,
  Timer,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { getChromeApi, getStorage, setStorage } from "@/utils/chrome";
import { EmailVerificationDialog } from "@/components/EmailVerificationDialog";
import TodoDeadlineBadge from "@/components/Tabs/TodoList/TodoDeadlineBadge";
import { calculateDDay } from "@/utils/todo/dateFormat";
import {
  invalidateECampusTodosCache,
  isECampusAccountCurrent,
  loginECampusAccount,
  notifyECampusTodosChange,
} from "@/utils/ecampus/todos";
import {
  clearECampusTodoCount,
  refreshTodoCount,
} from "@/utils/todo/count";
import { errorLog } from '@/utils/logger';
import {
  eCampusCredentialsSchema,
  getFirstValidationMessage,
} from "@/utils/formValidation";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SETTINGS_TABS = ["google", "ecampus"] as const;
const LAST_SETTINGS_TAB_STORAGE_KEY = "ui:lastSettingsTab:v1";

const ECampusCredential = () => {
  const [savedId, setSavedId] = useState<string>("");
  const [savedPassword, setSavedPassword] = useState<string>("");
  const [hasCredentials, setHasCredentials] = useState<boolean>(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 설정 페이지 열릴 때 저장된 계정 정보 불러오기
  useEffect(() => {
    let isMounted = true;

    loadECampusCredentials()
      .then((credentials) => {
        if (!isMounted) return;

        if (!credentials) {
          setSavedId("");
          setSavedPassword("");
          setHasCredentials(false);
          return;
        }

        setSavedId(credentials.id);
        setSavedPassword(credentials.password);
        setHasCredentials(true);
      })
      .catch((error) => {
        errorLog("[Settings] Load credentials error:", error);
        toast.error("인증 정보를 불러오는데 실패했습니다.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 인증 정보 저장하기
  const saveCredentials = async () => {
    const validation = eCampusCredentialsSchema.safeParse({
      userId: savedId,
      userPw: savedPassword,
    });
    if (!validation.success) {
      toast.error(getFirstValidationMessage(validation.error));
      return;
    }

    const credentials = validation.data;

    setIsSaving(true);

    try {
      const loginAttempt = await loginECampusAccount(
        credentials.userId,
        credentials.userPw,
      );
      if (loginAttempt.superseded) {
        toast.error("다른 계정 변경으로 저장을 완료하지 않았습니다.");
        return;
      }

      if (!loginAttempt.result.success) {
        toast.error(
          loginAttempt.result.data?.message ??
            "eCampus 로그인에 실패했습니다. ID와 비밀번호를 확인해주세요.",
        );
        return;
      }

      // 검증에 성공한 계정만 브라우저에 저장한다.
      await saveECampusCredentials(credentials.userId, credentials.userPw);
      if (!isECampusAccountCurrent(loginAttempt.requestGeneration)) {
        return;
      }

      setHasCredentials(true);
      sendSettingsCredentialsSaved();

      await clearECampusTodoCount().catch((countError) => {
        errorLog("[Settings] Failed to clear eCampus todo count:", countError);
      });
      if (!isECampusAccountCurrent(loginAttempt.requestGeneration)) {
        return;
      }

      notifyECampusTodosChange("clear");
      await refreshTodoCount(loginAttempt.requestGeneration);
      if (!isECampusAccountCurrent(loginAttempt.requestGeneration)) {
        return;
      }

      notifyECampusTodosChange("refresh");
      toast.success("인증 정보를 저장하고 eCampus 로그인을 확인했습니다.");
    } catch (error) {
      errorLog("[Settings] Save credentials error:", error);
      toast.error("인증 정보 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 인증 정보 삭제하기
  const deleteCredentials = async () => {
    if (!confirm("저장된 인증 정보를 삭제하시겠습니까?")) return;

    setIsSaving(true);

    try {
      await clearECampusCredentials();
      invalidateECampusTodosCache();
      await clearECampusTodoCount().catch((countError) => {
        errorLog("[Settings] Failed to clear eCampus todo count:", countError);
      });
      notifyECampusTodosChange("clear");
      setSavedId("");
      setSavedPassword("");
      setHasCredentials(false);
      sendSettingsCredentialsDeleted();
      toast.success("인증 정보가 삭제되었습니다.");
    } catch (error) {
      errorLog("[Settings] Delete credentials error:", error);
      toast.error("인증 정보 삭제에 실패했습니다.");
    } finally {
      setIsSaving(false);
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
              disabled={isSaving}
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
                disabled={isSaving}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                disabled={isSaving}
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
          disabled={!hasCredentials || isSaving}
          className="flex-1"
        >
          삭제
        </Button>
        <Button onClick={saveCredentials} disabled={isSaving} className="flex-1">
          {isSaving ? "확인 중..." : "저장"}
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
      const kuMail = await getStorage<string>('kuMail');
      if (kuMail) {
        setVerifiedEmail(kuMail);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    sendAuthLoginStart("google", "settings_dialog");

    try {
      const result = await startGoogleLogin();

      if (result.success) {
        setLoggedIn(true);

        // Check if this is a guest (requires signup)
        if (result.response.requiresSignup) {
          setIsGuest(true);
          sendAuthLoginSuccess("google", true);
          // Auto-open email verification dialog for guests
          setShowEmailVerification(true);
          toast.info("건국대 이메일 인증이 필요합니다.");
        } else {
          setIsGuest(false);
          setUserProfile(result.response.profile);
          sendAuthLoginSuccess("google", false);
          toast.success("로그인 성공!");
        }
      } else {
        sendAuthLoginFail("google", "login_failed", result.error || "알 수 없는 오류");
        toast.error("로그인 실패", {
          description: result.error,
        });
      }
    } catch (error) {
      errorLog("Login error:", error);
      const errMsg = error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.";
      sendAuthLoginFail("google", "exception", errMsg);
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
        const kuMail = await getStorage<string>('kuMail');
        if (kuMail) {
          setVerifiedEmail(kuMail);
        }

        toast.success("회원가입 완료!", {
          description: "이제 모든 기능을 사용할 수 있습니다.",
        });
      } else {
        // Still guest after re-login (edge case)
        toast.error("인증에 문제가 발생했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      errorLog("Re-login error:", error);
      toast.error("재로그인에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    sendAuthLogout("settings_dialog");

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
        <h2 className="text-base font-semibold">Google / Konkuk 계정 연동</h2>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              계정 연동을 하면 템플릿을 서버에 저장하고 여러 기기에서 동기화할 수 있습니다.
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
      <h2 className="text-base font-semibold">Google / Konkuk 계정 연동</h2>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={userProfile?.picture} alt={userProfile?.name} />
            <AvatarFallback>
              {userProfile?.name ? getInitials(userProfile.name) : <User className="h-6 w-6 text-muted-foreground" />}
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

    const chromeApi = getChromeApi();
    const editorUrl = chromeApi?.runtime?.getURL
      ? chromeApi.runtime.getURL('index.html#/editor')
      : `${window.location.origin}/#/editor`;

    if (chromeApi?.tabs?.create) {
      chromeApi.tabs.create({ url: editorUrl });
    } else {
      window.open(editorUrl, "_blank");
    }

    toast.success("템플릿 에디터를 새 탭에서 열었습니다.");
  };

  const handleOpenTemplateList = () => {
    sendButtonClick("open_template_list", "settings_dialog");

    const chromeApi = getChromeApi();
    const templateListUrl = chromeApi?.runtime?.getURL
      ? chromeApi.runtime.getURL('index.html#/templates')
      : `${window.location.origin}/#/templates`;

    if (chromeApi?.tabs?.create) {
      chromeApi.tabs.create({ url: templateListUrl });
    } else {
      window.open(templateListUrl, "_blank");
    }

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

const RealtimeTimer = () => {
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewDeadline] = useState(() => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1);
    const pad = (value: number) => String(value).padStart(2, "0");

    return {
      date: `${deadline.getFullYear()}.${pad(deadline.getMonth() + 1)}.${pad(deadline.getDate())}`,
      time: `${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`,
    };
  });
  const previewDDay = calculateDDay(
    previewDeadline.date,
    previewDeadline.time,
  );

  // 설정 페이지 열릴 때 저장된 설정 불러오기
  useEffect(() => {
    let isMounted = true;

    getStorage<boolean>("realtimeTimerEnabled")
      .then((saved) => {
        if (isMounted) {
          setEnabled(saved ?? true);
        }
      })
      .catch((error) => {
        errorLog("[Settings] Load timer setting error:", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = async () => {
    if (isSaving) return;

    const newValue = !enabled;
    setIsSaving(true);

    try {
      await setStorage({ realtimeTimerEnabled: newValue });
      setEnabled(newValue);
      sendSettingChange("realtime_timer", newValue ? "enabled" : "disabled");
      toast.success(
        newValue
          ? "실시간 타이머가 활성화되었습니다."
          : "실시간 타이머가 비활성화되었습니다."
      );
    } catch (error) {
      errorLog("[Settings] Save timer setting error:", error);
      toast.error("설정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Timer className="h-5 w-5" />
          실시간 TODO 타이머
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">타이머 표시</p>
              <p className="text-xs text-muted-foreground">
                24시간 이하 남은 Todo에 실시간 카운트다운 표시
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="실시간 Todo 타이머 표시"
              disabled={isSaving}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                enabled ? "bg-main" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div
            className="space-y-2 rounded-md border border-gray-200 bg-gray-50/50 p-3"
            aria-label="타이머 미리보기"
          >
            <p className="text-xs font-medium text-muted-foreground">
              타이머 미리보기
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">마감 임박 Todo</span>
              <TodoDeadlineBadge
                dDay={previewDDay}
                dueDate={previewDeadline.date}
                dueTime={previewDeadline.time}
                timerEnabled={enabled}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const tabs = usePersistentDialogTab({
    open,
    storageKey: LAST_SETTINGS_TAB_STORAGE_KEY,
    values: SETTINGS_TABS,
    defaultValue: "google",
    featureArea: "settings",
  });

  return (
    <UtilityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={SettingsIcon}
      title="설정"
      description="계정과 사용 환경을 관리해요."
      contentClassName="sm:max-w-[480px]"
    >
      <Tabs
        value={tabs.value}
        onValueChange={tabs.onValueChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="google">Google / Konkuk 계정 연동</TabsTrigger>
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
          <div className="pt-4 border-t">
            <SettingsDialog.RealtimeTimer />
          </div>
        </TabsContent>
      </Tabs>
    </UtilityDialog>
  );
};

SettingsDialog.GoogleOAuth = GoogleOAuthSection;
SettingsDialog.ECampusCredential = ECampusCredential;
SettingsDialog.TemplateEditor = TemplateEditorSection;
SettingsDialog.RealtimeTimer = RealtimeTimer;

export default SettingsDialog;
