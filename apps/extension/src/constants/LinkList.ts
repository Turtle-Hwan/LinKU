import type { MouseEventHandler } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  Bed,
  BellRing,
  BookCopy,
  Building,
  CalendarDays,
  Clock,
  GraduationCap,
  Lightbulb,
  MapPinned,
  MessageCircleMore,
  ScrollText,
  Trophy,
  University,
  UsersRound,
  Utensils,
} from "lucide-react";
import {
  WORKSPACE_QUICK_LINKS,
  type WorkspaceIconName,
  type WorkspaceQuickLink,
} from "@linku/platform";
import { HelloLmsPng } from "@/assets";
import { executeScript, getCurrentTab, updateTabUrl } from "@/utils/chrome";
import {
  sugangRefreshBtn,
  수강시뮬Btn,
  취득학점확인원Btn,
} from "@/utils/sugang";

export interface SameHost {
  content: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export interface LinkListElement {
  icon: LucideIcon | string;
  label: string;
  link: string;
  samehost?: SameHost;
  samehost2?: SameHost;
  islong?: boolean;
  iconColor?: string;
  type?: "png" | "svg";
}

const iconMap: Record<WorkspaceIconName, LucideIcon | string> = {
  University,
  BellRing,
  MonitorPlay: HelloLmsPng,
  Trophy,
  Clock3: Clock,
  MapPinned,
  GraduationCap,
  BookCopy,
  CalendarDays,
  Utensils,
  AlarmClock,
  UsersRound,
  BedDouble: Bed,
  MessagesSquare: MessageCircleMore,
  ScrollText,
  Building2: Building,
  Lightbulb,
  Library: BookCopy,
};

function runOnCurrentTab(script: () => void) {
  return () => {
    void getCurrentTab().then((tab) => {
      if (tab?.id) {
        void executeScript(tab.id, script);
      }
    });
  };
}

function sharedAction(
  link: WorkspaceQuickLink,
  index: number,
): SameHost | undefined {
  const action = link.actions?.[index];
  if (!action) {
    return undefined;
  }

  return {
    content: action.label.ko,
    onClick: () => updateTabUrl(action.href),
  };
}

function getExtensionActions(link: WorkspaceQuickLink) {
  switch (link.id) {
    case "course-registration":
      return {
        samehost: {
          content: "수강인원 새로고침",
          onClick: runOnCurrentTab(sugangRefreshBtn),
        },
        samehost2: sharedAction(link, 0),
      };
    case "campus-map":
      return {
        samehost: {
          content: "종강 == 법학관",
        },
      };
    case "kuis":
      return {
        samehost: {
          content: "취득학점확인원",
          onClick: runOnCurrentTab(취득학점확인원Btn),
        },
        samehost2: {
          content: "수강시뮬레이션",
          onClick: runOnCurrentTab(수강시뮬Btn),
        },
      };
    default:
      return {
        samehost: sharedAction(link, 0),
        samehost2: sharedAction(link, 1),
      };
  }
}

export const LinkList: LinkListElement[] = WORKSPACE_QUICK_LINKS.map((link) => ({
  icon: iconMap[link.icon],
  label: link.title.ko,
  link: link.href,
  islong: link.wide,
  type: link.icon === "MonitorPlay" ? "png" : undefined,
  iconColor: link.id === "everytime" ? "text-red-600" : undefined,
  ...getExtensionActions(link),
}));
