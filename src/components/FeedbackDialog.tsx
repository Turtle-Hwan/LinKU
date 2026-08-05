import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { submitFeedback } from "@/apis/feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  feedbackCategories,
  type FeedbackCategory,
} from "@/types/feedback";
import { sendButtonClick } from "@/utils/analytics";

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 500;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canContinue = title.trim().length >= 2 && message.trim().length >= 10;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canContinue || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await submitFeedback({ category, title, message });
      sendButtonClick("voc_submit", "voc_dialog");

      if (result.status === "persisted") {
        toast.success("의견을 안전하게 저장했어요.", {
          description: result.notificationSent
            ? "이 의견은 이미 VoC 다이제스트로 전달됐습니다."
            : "담당자는 매일 오전 9시 다이제스트로 확인합니다.",
        });
      } else {
        toast.info("의견을 이 기기에 임시 저장했어요.", {
          description: "다음에 LinKU를 열면 자동으로 다시 전송합니다.",
        });
      }

      setCategory("feature");
      setTitle("");
      setMessage("");
      onOpenChange(false);
    } catch {
      toast.error("의견을 저장하지 못했어요.", {
        description: "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden border-main/20 p-0">
        <DialogHeader className="bg-main/5 px-6 py-5 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-main/10 text-main">
              <Mail className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle>LinKU에 의견 보내기</DialogTitle>
              <DialogDescription>
                불편했던 점이나 필요한 기능을 들려주세요.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form className="space-y-5 px-6 py-5" onSubmit={handleSubmit}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">의견 유형</legend>
            <div className="grid grid-cols-2 gap-2">
              {feedbackCategories.map((option) => {
                const selected = option.value === category;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-main/40",
                      selected
                        ? "border-main bg-main/5 font-medium text-main"
                        : "border-border text-muted-foreground hover:border-main/40 hover:text-foreground",
                    )}
                    onClick={() => setCategory(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="feedback-title">한 줄 요약</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <Input
              id="feedback-title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              minLength={2}
              placeholder="예: 공지 검색이 더 쉬웠으면 좋겠어요"
              autoComplete="off"
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="feedback-message">자세한 내용</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <Textarea
              id="feedback-message"
              value={message}
              maxLength={MAX_MESSAGE_LENGTH}
              minLength={10}
              placeholder="어떤 상황에서 무엇이 불편했는지 알려주세요."
              className="min-h-28"
              required
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            의견은 Google Sheet에 먼저 저장되고, 메일은 매일 오전 9시에 한
            번만 모아서 발송됩니다. 전송이 어려우면 이 기기에 임시 보관한 뒤
            다시 시도합니다. 개인정보나 학번은 적지 마세요.
          </p>

          <DialogFooter className="flex-row justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!canContinue || isSubmitting}
              className="bg-main text-white hover:bg-hover"
            >
              {isSubmitting ? "저장 중..." : "의견 보내기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
