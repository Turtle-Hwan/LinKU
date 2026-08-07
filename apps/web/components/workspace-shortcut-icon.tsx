import Image from "next/image";
import {
  AlarmClock,
  BedDouble,
  BellRing,
  BookCopy,
  Building2,
  CalendarDays,
  Clock3,
  GraduationCap,
  Library,
  Lightbulb,
  MapPinned,
  MessagesSquare,
  ScrollText,
  Trophy,
  University,
  UsersRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceIconName } from "@linku/platform";
import { cn } from "@linku/ui";

const iconMap: Partial<Record<WorkspaceIconName, LucideIcon>> = {
  University,
  BellRing,
  Trophy,
  Clock3,
  MapPinned,
  GraduationCap,
  BookCopy,
  CalendarDays,
  Utensils,
  AlarmClock,
  UsersRound,
  BedDouble,
  MessagesSquare,
  ScrollText,
  Building2,
  Lightbulb,
  Library,
};

interface WorkspaceShortcutIconProps {
  icon: WorkspaceIconName;
  className?: string;
}

export function WorkspaceShortcutIcon({
  icon,
  className,
}: WorkspaceShortcutIconProps) {
  if (icon === "MonitorPlay") {
    return (
      <Image
        src="/brand/hello-lms.png"
        alt=""
        width={20}
        height={20}
        className={className}
      />
    );
  }

  const Icon = iconMap[icon] ?? University;

  return (
    <Icon
      className={cn(
        className,
        icon === "AlarmClock" ? "text-red-600" : undefined,
      )}
    />
  );
}
