import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import UtilityDialog from "@/components/UtilityDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getUserProfile,
  isLoggedIn,
  type UserProfile,
} from "@/utils/oauth";
import { updateAccountNickname } from "@/apis/supabase/account";
import { clearLinkuCloudData } from "@/apis/supabase/community";
import { SupabaseConfigurationError } from "@/apis/supabase/client";
import {
  getActiveSyncAccountId,
  resetSyncConnection,
} from "@/storage/account/syncRepository";
import {
  Info,
  Palette,
  LogOut,
  Settings as SettingsIcon,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { getChromeApi, getStorage, setStorage } from "@/utils/chrome";
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
import { captureErrorLog } from '@/utils/logger';
import { UserFacingError } from '@/errors/userFacingError';
import { isExpectedNetworkFailure } from '@/utils/networkFailure';
import { recordBreadcrumb } from '@/monitoring';
import {
  eCampusCredentialsSchema,
  getFirstValidationMessage,
} from "@/utils/formValidation";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function reportAccountFailure(message: string, error: unknown) {
  if (
    error instanceof UserFacingError ||
    error instanceof SupabaseConfigurationError ||
    isExpectedNetworkFailure(error)
  ) {
    recordBreadcrumb(
      'account.settings',
      message,
      {
        reason:
          error instanceof UserFacingError
            ? error.code
            : error instanceof SupabaseConfigurationError
              ? 'not_configured'
              : 'network',
      },
      'warning',
    );
    return;
  }
  captureErrorLog(message, error);
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
        captureErrorLog("[Settings] Load credentials error:", error);
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
        captureErrorLog("[Settings] Failed to clear eCampus todo count:", countError);
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
      captureErrorLog("[Settings] Save credentials error:", error);
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
        captureErrorLog("[Settings] Failed to clear eCampus todo count:", countError);
      });
      notifyECampusTodosChange("clear");
      setSavedId("");
      setSavedPassword("");
      setHasCredentials(false);
      sendSettingsCredentialsDeleted();
      toast.success("인증 정보가 삭제되었습니다.");
    } catch (error) {
      captureErrorLog("[Settings] Delete credentials error:", error);
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [hasSyncBinding, setHasSyncBinding] = useState(false);

  // Check login status on mount
  useEffect(() => {
    void checkLoginStatus().catch((error) => {
      reportAccountFailure("[Settings] Failed to load account profile", error);
    });
  }, []);

  // Listen for auth events
  useEffect(() => {
    const handleLogout = () => {
      setLoggedIn(false);
      setUserProfile(null);
      setNickname("");
    };
    const handleLogin = (event: Event) => {
      const profile = (event as CustomEvent<UserProfile>).detail;
      setLoggedIn(true);
      setUserProfile(profile);
      setNickname(profile.nickname);
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:login', handleLogin);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:login', handleLogin);
    };
  }, []);

  const checkLoginStatus = async () => {
    const [connected, boundAccountId] = await Promise.all([
      isLoggedIn(),
      getActiveSyncAccountId(),
    ]);
    setHasSyncBinding(boundAccountId !== null);
    setLoggedIn(connected);
    if (!connected) return;
    const profile = await getUserProfile();
    if (!profile) return;
    setUserProfile(profile);
    setNickname(profile.nickname);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    sendAuthLoginStart("google", "settings_dialog");

    try {
      const result = await startGoogleLogin();

      if (result.success) {
        setLoggedIn(true);
        setHasSyncBinding(true);
        setUserProfile(result.profile);
        setNickname(result.profile.nickname);
        sendAuthLoginSuccess("google", false);
        toast.success("로그인했습니다.");
      } else {
        sendAuthLoginFail("google", "login_failed", result.error || "알 수 없는 오류");
        toast.error("로그인 실패", {
          description: result.error,
        });
      }
    } catch (error) {
      captureErrorLog("Login error:", error);
      const errMsg = error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.";
      sendAuthLoginFail("google", "exception", errMsg);
      toast.error("오류", {
        description: "로그인 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    sendAuthLogout("settings_dialog");
    try {
      await logout();
      toast.success("로그아웃 완료");
    } catch (error) {
      reportAccountFailure('[Settings] Failed to sign out', error);
      toast.error('서버 로그아웃을 완료하지 못했지만 이 기기의 세션은 지웠습니다.');
    } finally {
      setLoggedIn(false);
      setUserProfile(null);
      setNickname("");
    }
  };

  const handleNicknameSave = async () => {
    setIsLoading(true);
    try {
      const profile = await updateAccountNickname(nickname);
      setUserProfile(profile);
      setNickname(profile.nickname);
      toast.success("공개 닉네임을 저장했습니다.");
    } catch (error) {
      reportAccountFailure("[Settings] Failed to update public nickname", error);
      toast.error(
        error instanceof Error ? error.message : "닉네임을 저장하지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloudDataDelete = async () => {
    if (
      !confirm(
        'Supabase에 동기화된 템플릿, 사용자 아이콘, 게시물을 모두 삭제하시겠습니까? 이 기기의 로컬 데이터와 LinKU 로그인 계정은 삭제되지 않습니다.',
      )
    ) {
      return;
    }

    setIsDeletingCloud(true);
    try {
      await clearLinkuCloudData();
      try {
        await logout();
      } catch (error) {
        reportAccountFailure('[Settings] Failed to sign out after clearing cloud data', error);
      }
      setLoggedIn(false);
      setUserProfile(null);
      setNickname('');
      toast.success('LinKU 클라우드 데이터를 삭제했습니다.');
    } catch (error) {
      reportAccountFailure('[Settings] Failed to clear cloud data', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'LinKU 클라우드 데이터를 삭제하지 못했습니다.',
      );
    } finally {
      setIsDeletingCloud(false);
    }
  };

  const handleSyncBindingReset = async () => {
    if (
      !confirm(
        '이 기기의 동기화 계정 연결을 초기화하시겠습니까? 로컬 템플릿은 유지되며, 다음에 로그인한 Google 계정으로 동기화됩니다.',
      )
    ) {
      return;
    }
    try {
      await resetSyncConnection();
      setHasSyncBinding(false);
      toast.success('동기화 계정 연결을 초기화했습니다.');
    } catch (error) {
      reportAccountFailure('[Settings] Failed to reset account binding', error);
      toast.error('동기화 계정 연결을 초기화하지 못했습니다.');
    }
  };

  if (!loggedIn) {
    // Not logged in - show login button
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">LinKU 계정 동기화</h2>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              로컬 템플릿은 로그인 없이도 계속 쓸 수 있고, Google 로그인 후에는 여러 기기에서 동기화됩니다.
            </p>
          </div>

          <Button
            onClick={handleGoogleLogin}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "로그인 중..." : "Google 로그인"}
          </Button>
          {hasSyncBinding && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => void handleSyncBindingReset()}
            >
              다른 Google 계정으로 전환
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">LinKU 계정 동기화</h2>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {userProfile?.nickname ?? 'LinKU 계정'}
            </p>
            <p className="text-sm text-muted-foreground">Google 계정으로 연결됨</p>
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

        <div className="space-y-2">
          <label htmlFor="publicNickname" className="text-sm font-medium">
            공개 닉네임
          </label>
          <div className="flex gap-2">
            <Input
              id="publicNickname"
              value={nickname}
              maxLength={32}
              onChange={(event) => setNickname(event.target.value)}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              onClick={handleNicknameSave}
              disabled={
                isLoading ||
                !userProfile ||
                nickname.trim().length === 0 ||
                nickname.trim() === userProfile?.nickname
              }
            >
              저장
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            게시한 템플릿에는 Google 이름이나 이메일 대신 이 닉네임만 표시됩니다.
          </p>
        </div>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">클라우드 데이터</p>
          <p className="text-xs text-muted-foreground">
            동기화본과 게시물만 삭제합니다. 이 기기의 템플릿과 Google 로그인 계정은 유지됩니다.
          </p>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            disabled={isDeletingCloud}
            onClick={() => void handleCloudDataDelete()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeletingCloud ? '삭제 중...' : 'LinKU 클라우드 데이터 삭제'}
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
        captureErrorLog("[Settings] Load timer setting error:", error);
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
      captureErrorLog("[Settings] Save timer setting error:", error);
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
          <TabsTrigger value="google">LinKU 계정</TabsTrigger>
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
