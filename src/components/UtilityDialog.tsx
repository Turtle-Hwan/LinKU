import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface UtilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
}

const UtilityDialog = ({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  children,
  contentClassName,
}: UtilityDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[440px] flex-col gap-0 overflow-hidden border-main/20 p-0 sm:max-w-[440px]",
          contentClassName,
        )}
      >
        <DialogHeader className="shrink-0 gap-0 border-b border-main/10 bg-main/5 py-2 pr-12 pl-2 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main">
              <Icon className="size-[18px]" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
              <DialogTitle className="shrink-0">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="min-w-0 truncate leading-none">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  {title} 대화상자
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

export default UtilityDialog;
