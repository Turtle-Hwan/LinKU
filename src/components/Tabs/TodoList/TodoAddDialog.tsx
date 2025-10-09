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
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
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

    if (!dueTime) {
      toast.error("마감 시간을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      // YYYY-MM-DD → YYYY.MM.DD 변환
      const formattedDate = dueDate.replace(/-/g, '.');

      await addCustomTodo(
        title.trim(),
        formattedDate,
        dueTime,
        subject.trim() || undefined
      );
      toast.success("할 일이 추가되었습니다.");

      // 폼 초기화
      setTitle("");
      setSubject("");
      setDueDate("");
      setDueTime("");

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
            <label htmlFor="subject" className="text-sm font-medium">
              과목명
            </label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="과목명 (선택사항)"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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

            <div className="space-y-2">
              <label htmlFor="dueTime" className="text-sm font-medium">
                마감 시간 <span className="text-red-500">*</span>
              </label>
              <Input
                id="dueTime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
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
