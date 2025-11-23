import { useState, useEffect, useCallback } from "react";
import { getAlerts, getMyAlerts } from "@/apis";
import type { Alert, AlertCategory } from "@/types/api";
import { getStorage, setStorage } from "@/utils/chrome";
import { toast } from "sonner";
import AlertItem from "./AlertItem";
import AlertFilter from "./AlertFilter";
import SubscriptionManager from "./SubscriptionManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [viewMode, setViewMode] = useState<AlertViewMode>("all");
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | undefined>(undefined);
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);

  // 공지사항 목록 가져오기
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = viewMode === "all"
        ? await getAlerts(selectedCategory ? { category: selectedCategory } : undefined)
        : await getMyAlerts();

      if (result.success && result.data) {
        let sortedData = result.data;

        // "전체" 선택 시 날짜/시간 순서대로 정렬 (최신순)
        if (viewMode === "all" && selectedCategory === undefined) {
          sortedData = [...result.data].sort((a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        }

        setAlerts(sortedData);
      } else {
        toast.error(result.error?.message || "공지사항을 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
      toast.error("공지사항을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, selectedCategory]);

  // 초기 로드 시 저장된 설정 불러오기
  useEffect(() => {
    const loadSettings = async () => {
      const savedViewMode = await getStorage<AlertViewMode>(ALERT_VIEW_MODE_KEY);
      const savedCategory = await getStorage<AlertCategory>(ALERT_CATEGORY_KEY);

      if (savedViewMode) {
        setViewMode(savedViewMode);
      }
      if (savedCategory) {
        setSelectedCategory(savedCategory);
      }
    };
    loadSettings();
  }, []);

  // 설정 변경 시 공지사항 다시 불러오기
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

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

  // 구독 업데이트 후 내 공지사항 새로고침
  const handleSubscriptionUpdate = () => {
    if (viewMode === "my") {
      fetchAlerts();
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* 헤더: 필터 및 구독 관리 버튼 */}
      <div className="p-4 border-t space-y-3">
        {/* 첫 번째 줄: 모든 공지 / 내 공지 / 구독 관리 */}
        <div className="flex justify-between items-center gap-2">
          <AlertFilter
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSubscriptionManager(!showSubscriptionManager)}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" />
            구독 관리
          </Button> */}
        </div>

        {/* 두 번째 줄: 카테고리 필터 (모든 공지 모드일 때만 표시) */}
        {viewMode === "all" && (
          <div className="flex gap-2 flex-wrap">
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
        )}

        {/* 구독 관리 섹션 */}
        {showSubscriptionManager && (
          <SubscriptionManager onUpdate={handleSubscriptionUpdate} />
        )}
      </div>

      {/* 공지사항 목록 */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-3"
        style={{ scrollbarWidth: "thin" }}
      >
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : alerts.length > 0 ? (
          alerts.map((alert) => (
            <AlertItem key={alert.alertId} alert={alert} />
          ))
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            {viewMode === "my" ? (
              <p>공지사항이 없습니다~ 구독 관리에서 학과를 구독해보세요!</p>
            ) : (
              <p>공지사항이 없습니다</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
