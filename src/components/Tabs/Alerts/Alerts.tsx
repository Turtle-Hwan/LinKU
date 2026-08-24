import { useState, useEffect, useMemo } from "react";
import { getAlerts, getCachedAlerts } from "@/apis";
import type { Alert, AlertCategory } from "@/types/api";
import { getStorage, setStorage } from "@/utils/chrome";
import { isLoggedIn as checkLoggedIn } from "@/utils/oauth";
import { toast } from "sonner";
import AlertItem from "./AlertItem";
import AlertFilter from "./AlertFilter";
import AlertSearch from "./AlertSearch";
import MyAlertsView from "./MyAlertsView";
import { Badge } from "@/components/ui/badge";
import { captureErrorLog } from '@/utils/logger';
import { sendAlertsView } from '@/utils/analytics';
import { matchesAlertQuery } from "./alertSearchUtils";

type AlertViewMode = "all" | "my";

const ALERT_VIEW_MODE_KEY = "alertViewMode";
const ALERT_CATEGORY_KEY = "alertCategory";

const categories: { value: AlertCategory | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "일반", label: "일반" },
  { value: "학사", label: "학사" },
  { value: "학생", label: "학생" },
  { value: "장학", label: "장학" },
  { value: "취창업", label: "취창업" },
  { value: "국제", label: "국제" },
];

const Alerts = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [viewMode, setViewMode] = useState<AlertViewMode>("all");
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | undefined>(undefined);
  const [loggedIn, setLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => matchesAlertQuery(alert, searchQuery)),
    [alerts, searchQuery]
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  // 초기화: 설정 + 로그인 상태를 한 번에 로드
  useEffect(() => {
    const initialize = async () => {
      const [savedViewMode, savedCategory, loginStatus] = await Promise.all([
        getStorage<AlertViewMode>(ALERT_VIEW_MODE_KEY),
        getStorage<AlertCategory>(ALERT_CATEGORY_KEY),
        checkLoggedIn(),
      ]);

      setLoggedIn(loginStatus);

      // 로그아웃 상태에서 저장된 viewMode가 "my"면 "all"로 변경
      if (savedViewMode === "my" && !loginStatus) {
        setViewMode("all");
      } else if (savedViewMode) {
        setViewMode(savedViewMode);
      }

      if (savedCategory) {
        setSelectedCategory(savedCategory);
      }

      setIsInitialized(true);

      const resolvedViewMode = (savedViewMode === "my" && !loginStatus) ? "all" : (savedViewMode || "all");
      const resolvedCategory = savedCategory || "전체";
      sendAlertsView(resolvedViewMode, resolvedCategory);
    };
    initialize();
  }, []);

  // 캐시를 먼저 표시하고 만료된 source만 뒤에서 갱신한다.
  useEffect(() => {
    if (!isInitialized || viewMode !== "all") {
      return;
    }

    let cancelled = false;

    const loadAlerts = async () => {
      const params = selectedCategory
        ? { category: selectedCategory }
        : undefined;
      let hasCachedAlerts = false;
      setIsLoading(true);

      try {
        const cachedAlerts = await getCachedAlerts(params);
        if (cancelled) return;

        if (cachedAlerts.length > 0) {
          hasCachedAlerts = true;
          setAlerts(cachedAlerts);
          setIsLoading(false);
        } else {
          setAlerts([]);
        }

        const result = await getAlerts(params);
        if (cancelled) return;

        if (result.success && result.data) {
          setAlerts(result.data);
        } else if (!hasCachedAlerts) {
          toast.error(
            result.error?.message || "공지사항을 불러오는데 실패했습니다.",
          );
        }
      } catch (error) {
        if (cancelled) return;

        captureErrorLog("Error fetching alerts:", error);
        if (!hasCachedAlerts) {
          toast.error("공지사항을 불러오는 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAlerts();

    return () => {
      cancelled = true;
    };
  }, [isInitialized, selectedCategory, viewMode]);

  // 뷰 모드 변경
  const handleViewModeChange = async (mode: AlertViewMode) => {
    setViewMode(mode);
    await setStorage({ [ALERT_VIEW_MODE_KEY]: mode });
  };

  // 카테고리 변경
  const handleCategoryChange = async (category: AlertCategory | undefined) => {
    setSelectedCategory(category);
    await setStorage({ [ALERT_CATEGORY_KEY]: category || null });
  };

  // 초기화 전 로딩 표시
  if (!isInitialized) {
    return (
      <div className="flex flex-col h-[500px] justify-center items-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* 헤더: 필터 */}
      <div className="p-4 border-t space-y-3">
        {/* 모든 공지 / 내 공지 탭 */}
        <div className="flex justify-between items-center gap-2">
          <AlertFilter
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            isLoggedIn={loggedIn}
          />
        </div>

        <AlertSearch value={searchQuery} onValueChange={setSearchQuery} />

        {/* 카테고리 필터 (모든 공지 모드일 때만 표시) */}
        <div className={viewMode === "all" ? "flex gap-2 flex-wrap" : "hidden"}>
          {categories.map((category) => (
            <Badge
              key={category.label}
              variant={selectedCategory === category.value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleCategoryChange(category.value)}
            >
              {category.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* 내 공지 모드 */}
        <div className={viewMode === "my" ? "" : "hidden"}>
          {loggedIn && <MyAlertsView searchQuery={searchQuery} />}
        </div>
        {/* 모든 공지 모드 */}
        <div className={viewMode === "all" ? "space-y-3" : "hidden"}>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <AlertItem
                key={alert.url || alert.alertId}
                alert={alert}
                searchQuery={searchQuery}
              />
            ))
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <p>
                {hasSearchQuery && alerts.length > 0
                  ? "검색 결과가 없습니다."
                  : "공지사항이 없습니다."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
