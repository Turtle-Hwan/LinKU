import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimetableActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant"
>;

export function TimetableActionButton({
  className,
  ...props
}: TimetableActionButtonProps) {
  return (
    <Button
      variant="outline"
      className={cn(
        "w-full border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 hover:text-neutral-900",
        className,
      )}
      {...props}
    />
  );
}
