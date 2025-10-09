import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DialogDescription } from "@radix-ui/react-dialog";
import { addCustomTodo } from "@/utils/customTodo";
import { toast } from "sonner";

interface TodoAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TodoAddDialog = ({ open, onOpenChange, onSuccess }: TodoAddDialogProps) => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("할 일 제목을 입력해주세요.");
      return;
    }

    if (!dueDate) {
      toast.error("마감일을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      await addCustomTodo(title.trim(), dueDate);
      toast.success("할 일이 추가되었습니다.");

      // 폼 초기화
      setTitle("");
      setDueDate("");

      // 다이얼로그 닫기
      onOpenChange(false);

      // 부모 컴포넌트에 성공 알림
      onSuccess();
    } catch (error) {
      console.error("Failed to add todo:", error);
      toast.error("할 일 추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 할 일 추가</DialogTitle>
          <DialogDescription className="hidden">
            나만의 할 일을 추가하세요
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              할 일 <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="할 일을 입력하세요"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="dueDate" className="text-sm font-medium">
              마감일 <span className="text-red-500">*</span>
            </label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="!flex !flex-row gap-2 !space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "추가 중..." : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TodoAddDialog;
