import { Button } from "@/components/ui/button";
import { ArrowUpDown, ListFilter } from "lucide-react";
import { TodoItem } from "@/types/todo";
import type { FilterMode, SortMethod } from "@/hooks/useTodoSettings";
import TodoAddButton from "./TodoAddButton";
import TodoExportButton from "./TodoExportButton";

interface TodoControlBarProps {
  sortMethod: SortMethod;
  filterMode: FilterMode;
  todoItems: TodoItem[];
  onSortMethodChange: () => void;
  onFilterModeChange: () => void;
  onTodoAdded: () => void;
}

/**
 * Todo 목록 상단 제어 바
 * 추가, 필터, 정렬, 복사 버튼을 포함
 */
const TodoControlBar = ({
  sortMethod,
  filterMode,
  todoItems,
  onSortMethodChange,
  onFilterModeChange,
  onTodoAdded,
}: TodoControlBarProps) => {
  return (
    <div className="flex justify-between items-center gap-2">
      <TodoAddButton onSuccess={onTodoAdded} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFilterModeChange}
          aria-pressed={filterMode === "incomplete"}
          aria-label={`Todo 필터: ${
            filterMode === "incomplete" ? "미완료만 표시" : "전체 표시"
          }`}
          className="gap-1.5"
        >
          <ListFilter className="h-4 w-4" />
          {filterMode === 'incomplete' ? '미완료' : '전체'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSortMethodChange}
          aria-pressed={sortMethod === "dday-asc"}
          aria-label={`마감일 정렬: ${
            sortMethod === "dday-asc" ? "오름차순" : "내림차순"
          }`}
          className="gap-1.5"
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortMethod === 'dday-asc' ? '오름차순' : '내림차순'}
        </Button>
        <TodoExportButton todoItems={todoItems} />
      </div>
    </div>
  );
};

export default TodoControlBar;
