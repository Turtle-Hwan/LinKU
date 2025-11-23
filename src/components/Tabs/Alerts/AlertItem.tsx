import type { Alert, GeneralNoticeCategory } from "@/types/api";
import { ExternalLink, Calendar, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertItemProps {
  alert: Alert;
}

// 일반 공지 카테고리별 라벨 (표시용)
const categoryLabels: Record<GeneralNoticeCategory, string> = {
  "일반": "일반",
  "학사": "학사",
  "학생": "학생",
  "장학": "장학",
  "채용": "채용",
  "국제": "국제",
  "에너지 절약": "에너지 절약",
};

// 일반 공지 카테고리별 색상
const categoryColors: Record<GeneralNoticeCategory, string> = {
  "일반": "bg-gray-100 text-gray-700",
  "학사": "bg-blue-100 text-blue-700",
  "학생": "bg-green-100 text-green-700",
  "장학": "bg-yellow-100 text-yellow-700",
  "채용": "bg-purple-100 text-purple-700",
  "국제": "bg-cyan-100 text-cyan-700",
  "에너지 절약": "bg-emerald-100 text-emerald-700",
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

  // 일반 공지인지 학과 공지인지 구분
  const isGeneralAlert = "category" in alert;
  const isDepartmentAlert = "department" in alert;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "border rounded-lg p-4 transition-all",
        isClickable && "cursor-pointer hover:shadow-md hover:border-primary/50",
        alert.isRead && "opacity-60"
      )}
    >
      {/* 헤더: 카테고리 또는 학과 */}
      <div className="flex items-center gap-2 mb-2">
        {isGeneralAlert && (
          <span
            className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              categoryColors[alert.category]
            )}
          >
            {categoryLabels[alert.category]}
          </span>
        )}
        {isDepartmentAlert && (
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
            <Building2 className="h-3.5 w-3.5" />
            <span>{alert.department.name}</span>
          </div>
        )}
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
