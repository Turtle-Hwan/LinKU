"use client";

import {
  AlarmClock,
  BedDouble,
  BellRing,
  BookCopy,
  Building2,
  CalendarDays,
  Clock3,
  ExternalLink,
  GraduationCap,
  Library,
  Lightbulb,
  MapPinned,
  MessagesSquare,
  MonitorPlay,
  ScrollText,
  Trophy,
  University,
  UsersRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import {
  WORKSPACE_QUICK_LINKS,
  localizeWorkspaceText,
  type WorkspaceIconName,
} from "@linku/platform";
import type { AppLocale } from "@/i18n/routing";

const iconMap: Record<WorkspaceIconName, LucideIcon> = {
  University,
  BellRing,
  MonitorPlay,
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

interface WorkspaceShortcutGridProps {
  shortcutIds: string[];
  locale: AppLocale;
  compact?: boolean;
}

export function WorkspaceShortcutGrid({
  shortcutIds,
  locale,
  compact = false,
}: WorkspaceShortcutGridProps) {
  const shortcuts = shortcutIds
    .map((id) => WORKSPACE_QUICK_LINKS.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  return (
    <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
      {shortcuts.map((shortcut) => {
        const Icon = iconMap[shortcut.icon];

        return (
          <article
            key={shortcut.id}
            className={`rounded-[1.4rem] border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(19,42,34,0.05)] ${
              compact ? "" : shortcut.wide ? "xl:col-span-2" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-[#d8f279]/40 text-[#132a22]">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-xl tracking-[-0.03em]">
                    {localizeWorkspaceText(shortcut.title, locale)}
                  </h3>
                  {!compact ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      {localizeWorkspaceText(shortcut.description, locale)}
                    </p>
                  ) : null}
                </div>
              </div>
              <a
                href={shortcut.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-xs text-[var(--muted)] transition hover:border-black/20 hover:text-[var(--ink)]"
              >
                <span>{locale === "ko" ? "열기" : "Open"}</span>
                <ExternalLink className="size-3" />
              </a>
            </div>

            {shortcut.actions?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {shortcut.actions.map((action) => (
                  <a
                    key={action.id}
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-full px-3 py-2 text-xs transition ${
                      action.recommendedFor === "extension"
                        ? "bg-[#132a22] text-white"
                        : "border border-black/10 bg-[#f6f0e1] text-[var(--ink)] hover:border-black/20"
                    }`}
                  >
                    {localizeWorkspaceText(action.label, locale)}
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
