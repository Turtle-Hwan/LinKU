import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getSubscriptions,
  getMySubscriptions,
  getMyAlerts,
  subscribeDepartment,
  unsubscribeDepartment,
} from "@/apis";
import type { Department, Subscription, GeneralAlert } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, X, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import AlertItem from "./AlertItem";

const MyAlertsView = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [myAlerts, setMyAlerts] = useState<GeneralAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDepartmentsLoaded, setIsDepartmentsLoaded] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);

  // 전체 학과 목록 로드 (드롭다운 열 때만)
  const loadDepartments = useCallback(async () => {
    if (isDepartmentsLoaded || isLoadingDepartments) return;

    setIsLoadingDepartments(true);
    try {
      const result = await getSubscriptions();
      if (result.success && Array.isArray(result.data)) {
        setDepartments(result.data);
        setIsDepartmentsLoaded(true);
      }
    } finally {
      setIsLoadingDepartments(false);
    }
  }, [isDepartmentsLoaded, isLoadingDepartments]);

  // 내 구독 + 내 공지 로드
  const loadMyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subscriptionsResult, alertsResult] = await Promise.all([
        getMySubscriptions(),
        getMyAlerts(),
      ]);

      if (subscriptionsResult.success && Array.isArray(subscriptionsResult.data)) {
        setMySubscriptions(subscriptionsResult.data);
      }

      if (alertsResult.success && Array.isArray(alertsResult.data)) {
        setMyAlerts(alertsResult.data);
      }
    } catch (error) {
      console.error("Failed to load my data:", error);
      toast.error("데이터를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 드롭다운 열릴 때 학과 목록 로드
  const handleDropdownOpen = (open: boolean) => {
    if (open) {
      loadDepartments();
    }
  };

  // 초기 로드 (내 구독 + 내 공지만)
  useEffect(() => {
    loadMyData();
  }, [loadMyData]);

  // 학과 구독
  const handleSubscribe = async (departmentId: number) => {
    // 이미 구독 중인지 확인
    if (mySubscriptions.some((sub) => sub.department.id === departmentId)) {
      toast.info("이미 구독 중인 학과입니다.");
      return;
    }

    setIsSubscribing(true);
    try {
      const result = await subscribeDepartment(departmentId);
      if (result.success) {
        toast.success("학과 구독 완료!");
        await loadMyData(); // 목록 새로고침
      } else {
        toast.error(result.error?.message || "구독에 실패했습니다.");
      }
    } catch (error) {
      console.error("Subscribe error:", error);
      toast.error("구독 중 오류가 발생했습니다.");
    } finally {
      setIsSubscribing(false);
    }
  };

  // 구독 취소
  const handleUnsubscribe = async (departmentId: number) => {
    try {
      const result = await unsubscribeDepartment(departmentId);
      if (result.success) {
        toast.success("구독 취소 완료");
        await loadMyData(); // 목록 새로고침
      } else {
        toast.error(result.error?.message || "구독 취소에 실패했습니다.");
      }
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toast.error("구독 취소 중 오류가 발생했습니다.");
    }
  };

  // 구독 가능한 학과만 필터링 (이미 구독 중인 학과 제외)
  const availableDepartments = departments.filter(
    (dept) => !mySubscriptions.some((sub) => sub.department.id === dept.id)
  );

  // 공지사항 시간순 정렬 (최신순)
  const sortedAlerts = useMemo(() => {
    return [...myAlerts].sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return dateB - dateA;
    });
  }, [myAlerts]);

  return (
    <div className="space-y-4">
      {/* 학과 구독 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">학과 구독</span>
        </div>

        {/* 학과 선택 드롭다운 */}
        <DropdownMenu onOpenChange={handleDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={isSubscribing || (isDepartmentsLoaded && availableDepartments.length === 0)}
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  구독 중...
                </>
              ) : isDepartmentsLoaded && availableDepartments.length === 0 ? (
                "구독 가능한 학과 없음"
              ) : (
                "학과 선택"
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) p-0">
            <ScrollArea className="max-h-[min(300px,var(--radix-dropdown-menu-content-available-height))]">
              <div className="p-1">
                {isLoadingDepartments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : availableDepartments.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    구독 가능한 학과가 없습니다
                  </div>
                ) : (
                  availableDepartments.map((dept) => (
                    <DropdownMenuItem
                      key={dept.id}
                      onClick={() => handleSubscribe(dept.id)}
                    >
                      {dept.name}
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 구독 중인 학과 뱃지 */}
        {mySubscriptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mySubscriptions.map((sub) => (
              <Badge
                key={sub.subscriptionId}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive/20 transition-colors"
                onClick={() => handleUnsubscribe(sub.department.id)}
              >
                {sub.department.name}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div className="border-t" />

      {/* 내 공지사항 목록 */}
      <div className="space-y-3">
        <span className="text-sm font-medium">내 공지사항</span>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedAlerts.length > 0 ? (
          <div className="space-y-3">
            {sortedAlerts.map((alert) => (
              <AlertItem key={alert.alertId} alert={alert} />
            ))}
          </div>
        ) : mySubscriptions.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            <p>구독한 학과가 없습니다.</p>
            <p className="text-sm mt-1">위에서 학과를 선택해 구독해보세요!</p>
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            <p>새로운 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAlertsView;
