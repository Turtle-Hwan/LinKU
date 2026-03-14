import { TodoItem as TodoItemType } from "@/types/todo";
import { Trash2 } from "lucide-react";
import { formatTodoDateTime, parseECampusToTimerFormat } from "@/utils/todo/dateFormat";
import { shouldShowTimer } from "@/utils/todo/timer";
import TodoCountdown from "./TodoCountdown";

interface TodoItemProps {
  todo: TodoItemType;
  timerEnabled?: boolean;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: () => void;
}

const getDdayBadgeClassName = (dDay: string) => {
  if (dDay === "마감" || dDay.startsWith("D+")) {
    return "px-2 py-1 bg-gray-900/10 text-gray-900 rounded-full text-xs";
  }

  return "px-2 py-1 bg-main/10 text-main rounded-full text-xs";
};

const TodoItem = ({ todo, timerEnabled = false, onToggle, onDelete, onClick }: TodoItemProps) => {
  if (todo.type === 'ecampus') {
    // 이캠퍼스 Todo - 검정색 테두리로 통일
    const parsed = parseECampusToTimerFormat(todo.dueDate);
    const showTimer = timerEnabled && parsed && shouldShowTimer(parsed.date, parsed.time);

    return (
      <div
        className="p-3 border border-main rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <div className="text-sm font-semibold mb-1 flex items-center justify-between">
          <p>{todo.title}</p>
          <div className="flex flex-col items-end gap-1">
            {showTimer && parsed ? (
              <TodoCountdown dueDate={parsed.date} dueTime={parsed.time} />
            ) : (
              <span className={getDdayBadgeClassName(todo.dDay)}>
                {todo.dDay}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700">{todo.subject}</p>
        <p className="text-xs text-gray-600 mt-1">{todo.dueDate}</p>
      </div>
    );
  } else {
    // 사용자 정의 Todo - 검은색 테두리
    const formattedDateTime = formatTodoDateTime(todo.dueDate, todo.dueTime);
    const showTimer = timerEnabled && shouldShowTimer(todo.dueDate, todo.dueTime);

    return (
      <div className="relative p-3 border border-black rounded-md transition-colors hover:bg-gray-50">
        {/* 클릭 가능한 컨텐츠 영역 - 완료 상태 토글 */}
        <div
          onClick={() => onToggle?.(todo.id)}
          className={`cursor-pointer ${todo.completed ? 'opacity-70' : ''
            }`}
        >
          <div className="text-sm font-semibold mb-1 flex items-center justify-between">
            <p className={todo.completed ? 'line-through text-gray-500' : ''}>
              {todo.title}
            </p>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {showTimer ? (
                <TodoCountdown dueDate={todo.dueDate} dueTime={todo.dueTime} />
              ) : (
                <span className={getDdayBadgeClassName(todo.dDay)}>
                  {todo.dDay}
                </span>
              )}
            </div>
          </div>
          {todo.subject && (
            <p className={`text-sm text-gray-700 ${todo.completed ? 'line-through text-gray-500' : ''}`}>
              {todo.subject}
            </p>
          )}
          <p className={`text-xs text-gray-600 mt-1 ${todo.completed ? 'line-through' : ''}`}>
            {formattedDateTime}
          </p>
        </div>

        {/* 우하단 체크박스와 삭제 버튼 */}
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(todo.id);
            }}
            className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
              todo.completed
                ? 'bg-main text-white border-2 border-main'
                : 'bg-gray-200 border-2 border-gray-400 hover:bg-main hover:border-main'
            }`}
            aria-label={todo.completed ? "완료 취소" : "완료"}
          >
            <span className="text-sm leading-none font-bold">
              {todo.completed ? '✓' : ''}
            </span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(todo.id);
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            aria-label="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
};

export default TodoItem;
