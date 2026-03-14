import { Button } from "@/components/ui/button";
import { ArrowUpDown, ListFilter } from "lucide-react";
import { TodoItem } from "@/types/todo";
import TodoAddButton from "./TodoAddButton";
import TodoExportButton from "./TodoExportButton";

type SortMethod = 'dday-asc' | 'dday-desc';
type FilterMode = 'all' | 'incomplete';

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
          variant="outline"
          size="sm"
          onClick={onFilterModeChange}
          className="gap-1.5"
        >
          <ListFilter className="h-4 w-4" />
          {filterMode === 'incomplete' ? '미완료' : '전체'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSortMethodChange}
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
