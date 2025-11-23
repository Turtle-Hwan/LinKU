import type { AlertCategory } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AlertViewMode = "all" | "my";

interface AlertFilterProps {
  viewMode: AlertViewMode;
  selectedCategory: AlertCategory | undefined;
  onViewModeChange: (mode: AlertViewMode) => void;
  onCategoryChange: (category: AlertCategory | undefined) => void;
}

const categories: { value: AlertCategory | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "일반", label: "일반" },
  { value: "학사", label: "학사" },
  { value: "학생", label: "학생" },
  { value: "장학", label: "장학" },
  { value: "취창업", label: "취창업" },
  { value: "국제", label: "국제" },
];

const AlertFilter = ({
  viewMode,
  selectedCategory,
  onViewModeChange,
  onCategoryChange,
}: AlertFilterProps) => {
  return (
    <div className="flex flex-col gap-2">
      {/* 모든 공지 / 내 공지 토글 */}
      <div className="flex border rounded-lg p-[3px] w-fit">
        <Button
          variant={viewMode === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("all")}
          className="h-8 px-3"
        >
          모든 공지
        </Button>
        <Button
          variant={viewMode === "my" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("my")}
          className="h-8 px-3"
        >
          내 공지
        </Button>
      </div>

      {/* 카테고리 선택 (모든 공지 모드일 때만 표시) */}
      {viewMode === "all" && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <Badge
              key={category.label}
              variant={selectedCategory === category.value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onCategoryChange(category.value)}
            >
              {category.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertFilter;
