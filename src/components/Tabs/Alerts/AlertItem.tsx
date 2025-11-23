import type { Alert } from "@/types/api";
import { ExternalLink, Calendar, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertItemProps {
  alert: Alert;
}

// 카테고리 한글 매핑
const categoryLabels: Record<string, string> = {
  BASE: "일반",
  ACADEMIC: "학사",
  STUDENT: "학생",
  EMPLOYMENT: "취업",
  SCHOLARSHIP: "장학",
};

// 카테고리별 색상
const categoryColors: Record<string, string> = {
  BASE: "bg-gray-100 text-gray-700",
  ACADEMIC: "bg-blue-100 text-blue-700",
  STUDENT: "bg-green-100 text-green-700",
  EMPLOYMENT: "bg-purple-100 text-purple-700",
  SCHOLARSHIP: "bg-yellow-100 text-yellow-700",
};

const AlertItem = ({ alert }: AlertItemProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const handleClick = () => {
    if (alert.url) {
      window.open(alert.url, "_blank");
    }
  };

  const isClickable = Boolean(alert.url);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "border rounded-lg p-4 transition-all",
        isClickable && "cursor-pointer hover:shadow-md hover:border-primary/50",
        alert.isRead && "opacity-60"
      )}
    >
      {/* 헤더: 카테고리와 학과 */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            categoryColors[alert.category] || "bg-gray-100 text-gray-700"
          )}
        >
          {categoryLabels[alert.category] || alert.category}
        </span>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span>{alert.department.name}</span>
        </div>
      </div>

      {/* 제목 */}
      <h3 className="font-medium text-base mb-2 flex items-start justify-between gap-2">
        <span className="flex-1 break-words">{alert.title}</span>
        {isClickable && <ExternalLink className="h-4 w-4 flex-shrink-0 mt-0.5" />}
      </h3>

      {/* 내용 미리보기 */}
      {alert.content && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 break-words">
          {alert.content}
        </p>
      )}

      {/* 하단: 발행일 */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>{formatDate(alert.publishedAt)}</span>
      </div>
    </div>
  );
};

export default AlertItem;
