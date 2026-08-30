import { useEffect, useMemo, useState } from "react";
import { getAlerts, getCachedAlerts } from "@/apis";
import type { Alert, AlertCategory } from "@/types/api";
import { getStorage, setStorage } from "@/utils/chrome";
import { toast } from "sonner";
import AlertItem from "./AlertItem";
import AlertSearch from "./AlertSearch";
import { Badge } from "@/components/ui/badge";
import { captureErrorLog } from "@/utils/logger";
import { sendAlertsView } from "@/utils/analytics";
import { matchesAlertQuery } from "./alertSearchUtils";

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
  const [selectedCategory, setSelectedCategory] = useState<
    AlertCategory | undefined
  >();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => matchesAlertQuery(alert, searchQuery)),
    [alerts, searchQuery],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    void getStorage<AlertCategory>(ALERT_CATEGORY_KEY).then((savedCategory) => {
      setSelectedCategory(savedCategory);
      setIsInitialized(true);
      sendAlertsView("all", savedCategory ?? "전체");
    });
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    let cancelled = false;

    const loadAlerts = async () => {
      const params = selectedCategory ? { category: selectedCategory } : undefined;
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
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [isInitialized, selectedCategory]);

  const handleCategoryChange = async (category: AlertCategory | undefined) => {
    setSelectedCategory(category);
    await setStorage({ [ALERT_CATEGORY_KEY]: category ?? null });
  };

  if (!isInitialized) {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[500px] flex-col">
      <div className="space-y-3 border-t p-4">
        <AlertSearch value={searchQuery} onValueChange={setSearchQuery} />
        <div className="flex flex-wrap gap-2">
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

      <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:thin]">
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
            <div className="p-8 text-center text-muted-foreground">
              {hasSearchQuery && alerts.length > 0
                ? "검색 결과가 없습니다."
                : "공지사항이 없습니다."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
