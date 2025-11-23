import { useState, useEffect, useCallback } from "react";
import {
  getSubscriptions,
  getMySubscriptions,
  subscribeDepartment,
  unsubscribeDepartment,
} from "@/apis";
import type { Department, Subscription } from "@/types/api";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionManagerProps {
  onUpdate?: () => void;
}

const SubscriptionManager = ({ onUpdate }: SubscriptionManagerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState("");

  // 구독 목록 불러오기
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [departmentsResult, subscriptionsResult] = await Promise.all([
        getSubscriptions(),
        getMySubscriptions(),
      ]);

      if (departmentsResult.success && departmentsResult.data) {
        setAllDepartments(departmentsResult.data);
      } else {
        setError(departmentsResult.error?.message || "학과 목록을 불러오는데 실패했습니다.");
      }

      if (subscriptionsResult.success && subscriptionsResult.data) {
        setMySubscriptions(subscriptionsResult.data);
      }
    } catch (error) {
      console.error("Error fetching subscription data:", error);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 구독 여부 확인
  const isSubscribed = (departmentId: number) => {
    return mySubscriptions.some((sub) => sub.department.id === departmentId);
  };

  // 구독 처리
  const handleSubscribe = async (departmentId: number, departmentName: string) => {
    try {
      const result = await subscribeDepartment(departmentId);

      if (result.success) {
        toast.success(`${departmentName} 구독이 완료되었습니다.`);
        await fetchData();
        onUpdate?.();
      } else {
        toast.error(result.error?.message || "구독에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error subscribing:", error);
      toast.error("구독 중 오류가 발생했습니다.");
    }
  };

  // 구독 취소 처리
  const handleUnsubscribe = async (departmentId: number, departmentName: string) => {
    try {
      const result = await unsubscribeDepartment(departmentId);

      if (result.success) {
        toast.success(`${departmentName} 구독이 취소되었습니다.`);
        await fetchData();
        onUpdate?.();
      } else {
        toast.error(result.error?.message || "구독 취소에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("구독 취소 중 오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex justify-center p-4">
          <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-medium text-sm">학과 구독 관리</h3>

      {/* 내가 구독한 학과 */}
      {mySubscriptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">구독 중인 학과</p>
          <div className="flex flex-wrap gap-2">
            {mySubscriptions.map((sub) => (
              <div
                key={sub.subscriptionId}
                className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{sub.department.name}</span>
                <button
                  onClick={() =>
                    handleUnsubscribe(sub.department.id, sub.department.name)
                  }
                  className="ml-1 hover:bg-primary/20 rounded p-0.5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 구독 가능한 학과 */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">구독 가능한 학과</p>
        <div className="max-h-[200px] overflow-y-auto space-y-1" style={{ scrollbarWidth: "thin" }}>
          {allDepartments
            .filter((dept) => !isSubscribed(dept.id))
            .map((dept) => (
              <button
                key={dept.id}
                onClick={() => handleSubscribe(dept.id, dept.name)}
                className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover:bg-gray-100 transition-colors text-sm"
              >
                <span>{dept.name}</span>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;
