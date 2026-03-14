import { Button } from "@/components/ui/button";

type AlertViewMode = "all" | "my";

interface AlertFilterProps {
  viewMode: AlertViewMode;
  onViewModeChange: (mode: AlertViewMode) => void;
  isLoggedIn: boolean;
}

const AlertFilter = ({
  viewMode,
  onViewModeChange,
  isLoggedIn,
}: AlertFilterProps) => {
  return (
    <div className="flex border rounded-lg p-[3px] w-fit">
      <Button
        variant={viewMode === "all" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("all")}
        className="h-8 px-3"
      >
        모든 공지
      </Button>
      {isLoggedIn && (
        <Button
          variant={viewMode === "my" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("my")}
          className="h-8 px-3"
        >
          내 공지
        </Button>
      )}
    </div>
  );
};

export default AlertFilter;
