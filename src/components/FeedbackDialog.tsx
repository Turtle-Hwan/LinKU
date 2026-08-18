import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { submitFeedback } from "@/apis/feedback";
import UtilityDialog from "@/components/UtilityDialog";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_LIMITS, feedbackInputSchema } from "@/types/feedback";
import { sendButtonClick } from "@/utils/analytics";
import { errorLog } from "@/utils/logger";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const [contactEmail, setContactEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    const input = feedbackInputSchema.safeParse({
      contactEmail,
      title,
      message,
    });
    if (!input.success) {
      toast.error(input.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitFeedback(input.data);
      void sendButtonClick("voc_submit", "voc_dialog");

      if (result.status === "persisted") {
        toast.success("소중한 의견 감사해요.");
      } else {
        toast.info("의견을 이 기기에 임시 저장했어요.", {
          description: "다음에 LinKU를 열면 자동으로 다시 전송합니다.",
        });
      }

      setContactEmail("");
      setTitle("");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      errorLog("[Feedback] Failed to submit feedback:", error);
      toast.error("의견을 저장하지 못했어요.", {
        description: "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <UtilityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      title="LinKU에 의견 보내기"
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label
            htmlFor="feedback-contact-email"
            className="flex items-baseline gap-1 whitespace-nowrap"
          >
            이메일
            <span className="text-xs font-normal text-muted-foreground">
              (답장을 받고 싶으신 경우에만 입력해 주세요)
            </span>
          </Label>
          <Input
            id="feedback-contact-email"
            name="contactEmail"
            type="email"
            value={contactEmail}
            maxLength={FEEDBACK_LIMITS.contactEmail.max}
            placeholder="example@email.com"
            autoComplete="email"
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="feedback-title"
            className="flex items-center gap-1"
          >
            제목
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(필수)</span>
          </Label>
          <Input
            id="feedback-title"
            name="title"
            value={title}
            maxLength={FEEDBACK_LIMITS.title.max}
            minLength={FEEDBACK_LIMITS.title.min}
            placeholder="한 줄로 적어주세요"
            autoComplete="off"
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="feedback-message"
            className="flex items-center gap-1"
          >
            내용
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(필수)</span>
          </Label>
          <Textarea
            id="feedback-message"
            name="message"
            value={message}
            maxLength={FEEDBACK_LIMITS.message.max}
            minLength={FEEDBACK_LIMITS.message.min}
            placeholder="의견을 자유롭게 적어주세요"
            className="min-h-28"
            required
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

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
            disabled={isSubmitting}
            className="bg-main text-white hover:bg-hover"
          >
            {isSubmitting ? "저장 중..." : "의견 보내기"}
          </Button>
        </DialogFooter>
      </form>
    </UtilityDialog>
  );
};

export default FeedbackDialog;
