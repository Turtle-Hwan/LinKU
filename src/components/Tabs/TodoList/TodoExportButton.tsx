import { TodoItem } from "@/types/todo";
import { Button } from "@/components/ui/button";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import { convertTodosToMarkdown } from "@/utils/todoMarkdown";
import { Copy, Check } from "lucide-react";

interface TodoExportButtonProps {
  todoItems: TodoItem[];
}

/**
 * Todo 리스트를 마크다운 형식으로 클립보드에 복사하는 버튼 컴포넌트
 *
 * @param todoItems - 복사할 Todo 항목 배열
 */
const TodoExportButton = ({ todoItems }: TodoExportButtonProps) => {
  const { copyToClipboard, isCopied } = useClipboardCopy();

  const handleExport = () => {
    const markdown = convertTodosToMarkdown(todoItems);
    copyToClipboard(markdown);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-2"
      aria-label="Todo 리스트를 마크다운으로 복사"
    >
      {isCopied ? (
        <>
          <Check className="h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy
        </>
      )}
    </Button>
  );
};

export default TodoExportButton;
