import React from "react";
import {
  CalendarDays,
  Ellipsis,
  ImageUp,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import EverytimeSymbolUrl from "@/assets/everytime_symbol.svg";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TimetableBusyState } from "@/hooks/useTimetable";
import type { TimetableSource } from "@/types/timetable";

interface TimetableSavedActionsProps {
  busy: TimetableBusyState;
  source: TimetableSource;
  onDelete: () => void;
  onImport: () => void;
  onImportPreviousSemesters: () => void;
  onUpload: () => void;
}

function TimetableSavedActionsComponent({
  busy,
  source,
  onDelete,
  onImport,
  onImportPreviousSemesters,
  onUpload,
}: TimetableSavedActionsProps) {
  const isBusy = busy !== null;
  const importLabel = source === "everytime" ? "동기화" : "에타 가져오기";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 border-neutral-300 bg-white px-2.5 text-neutral-900 hover:bg-neutral-50 hover:text-neutral-900"
        disabled={isBusy}
        onClick={onImport}
      >
        {busy === "importing" ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <img
            src={EverytimeSymbolUrl}
            alt=""
            aria-hidden="true"
            className="size-4"
          />
        )}
        {importLabel}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="시간표 더보기"
            disabled={isBusy}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onUpload}>
            <ImageUp />
            PNG 시간표 올리기
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onImportPreviousSemesters}>
            <CalendarDays />
            이전 4학기 추가
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 />
            현재 시간표 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const TimetableSavedActions = React.memo(
  TimetableSavedActionsComponent,
);
