import { TodoItem as TodoItemType } from "@/types/todo";
import { Trash2 } from "lucide-react";
import { formatTodoDateTime } from "@/utils/todo/dateFormat";
import { useState, useEffect } from "react";
import { getSubjectLabelByName } from "@/utils/subjectLabel";
import { SubjectLabel } from "@/types/subjectLabel";

interface TodoItemProps {
  todo: TodoItemType;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: () => void;
}

const TodoItem = ({ todo, onToggle, onDelete, onClick }: TodoItemProps) => {
  const [subjectLabel, setSubjectLabel] = useState<SubjectLabel | null>(null);

  useEffect(() => {
    const loadSubjectLabel = async () => {
      if (todo.subject) {
        const label = await getSubjectLabelByName(todo.subject);
        setSubjectLabel(label || null);
      }
    };
    loadSubjectLabel();
  }, [todo.subject]);

  if (todo.type === 'ecampus') {
    // 이캠퍼스 Todo - 진초록색 테두리
    return (
      <div
        className="p-3 border border-main rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <div className="text-sm font-semibold mb-1 flex items-center justify-between">
          <p>{todo.title}</p>
          <span className="px-2 py-1 bg-main/10 text-main rounded-full text-xs">
            {todo.dDay}
          </span>
        </div>
        {todo.subject && (
          <div className="flex items-center gap-2 mt-1">
            {subjectLabel && (
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: subjectLabel.color }}
              />
            )}
            <p className="text-sm text-gray-700">{todo.subject}</p>
          </div>
        )}
        <p className="text-xs text-gray-600 mt-1">{todo.dueDate}</p>
      </div>
    );
  } else {
    // 사용자 정의 Todo - 검은색 테두리 (eCampus와 동일한 레이아웃)
    const formattedDateTime = formatTodoDateTime(todo.dueDate, todo.dueTime);

    return (
      <div className="relative p-3 border rounded-md transition-colors hover:bg-gray-50">
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
            <span className="px-2 py-1 bg-main/10 text-main rounded-full text-xs shrink-0">
              {todo.dDay}
            </span>
          </div>
          {todo.subject && (
            <div className="flex items-center gap-2 mt-1">
              {subjectLabel && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: subjectLabel.color }}
                />
              )}
              <p className={`text-sm text-gray-700 ${todo.completed ? 'line-through text-gray-500' : ''}`}>
                {todo.subject}
              </p>
            </div>
          )}
          <p className={`text-xs text-gray-600 mt-1 ${todo.completed ? 'line-through' : ''}`}>
            {formattedDateTime}
          </p>
        </div>

        {/* 우하단 삭제 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(todo.id);
          }}
          className="absolute right-2 bottom-2 text-gray-400 hover:text-red-500 transition-colors p-1"
          aria-label="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }
};

export default TodoItem;
