import type { Icon, TemplateItemRequest } from "@linku/shared-types";
import {
  WORKSPACE_QUICK_LINKS,
  localizeWorkspaceText,
  type WorkspaceIconName,
  type WorkspaceLocale,
} from "@linku/platform";
import type { WorkspaceTemplateRecord } from "@/lib/workspace-templates";

function calculateGridPosition(shortcutIds: string[], targetIndex: number) {
  let currentColumn = 0;
  let currentRow = 0;

  for (let index = 0; index < targetIndex; index += 1) {
    const shortcut = WORKSPACE_QUICK_LINKS.find((item) => item.id === shortcutIds[index]);
    if (!shortcut) {
      continue;
    }

    const width = shortcut.wide ? 3 : 2;

    if (currentColumn + width > 6) {
      currentColumn = 0;
      currentRow += 1;
    }

    currentColumn += width;
  }

  const currentShortcut = WORKSPACE_QUICK_LINKS.find(
    (item) => item.id === shortcutIds[targetIndex],
  );
  const currentWidth = currentShortcut?.wide ? 3 : 2;

  if (currentColumn + currentWidth > 6) {
    currentColumn = 0;
    currentRow += 1;
  }

  return {
    x: currentColumn,
    y: currentRow,
  };
}

const iconKeywordMap: Record<WorkspaceIconName, string[]> = {
  University: ["university", "school", "home"],
  BellRing: ["bell", "notice", "alert"],
  MonitorPlay: ["monitor", "video", "ecampus"],
  Trophy: ["trophy", "award", "wein"],
  Clock3: ["clock", "time", "course"],
  MapPinned: ["map", "pin", "location"],
  GraduationCap: ["graduation", "cap", "portal", "academic"],
  BookCopy: ["book", "copy", "study"],
  CalendarDays: ["calendar", "schedule"],
  Utensils: ["utensil", "food", "meal"],
  AlarmClock: ["alarm", "clock", "community"],
  UsersRound: ["users", "people", "department"],
  BedDouble: ["bed", "house", "dorm"],
  MessagesSquare: ["message", "chat", "community"],
  ScrollText: ["scroll", "bulletin", "document"],
  Building2: ["building", "office", "practice"],
  Lightbulb: ["light", "idea", "startup"],
  Library: ["library", "book"],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function matchIcon(shortcutId: string, icons: Icon[]) {
  const shortcut = WORKSPACE_QUICK_LINKS.find((item) => item.id === shortcutId);

  if (!shortcut) {
    return null;
  }

  const normalizedName = normalize(shortcut.icon);
  const normalizedKoTitle = normalize(localizeWorkspaceText(shortcut.title, "ko"));
  const normalizedEnTitle = normalize(localizeWorkspaceText(shortcut.title, "en"));
  const keywords = iconKeywordMap[shortcut.icon].map(normalize);

  return (
    icons.find((icon) => normalize(icon.name) === normalizedName) ||
    icons.find((icon) => normalize(icon.name).includes(normalizedName)) ||
    icons.find((icon) => normalize(icon.name).includes(normalizedKoTitle)) ||
    icons.find((icon) => normalize(icon.name).includes(normalizedEnTitle)) ||
    icons.find((icon) =>
      keywords.some((keyword) => normalize(icon.name).includes(keyword)),
    ) ||
    null
  );
}

export function buildRemoteTemplatePayload(
  template: WorkspaceTemplateRecord,
  icons: Icon[],
  locale: WorkspaceLocale,
) {
  const items = template.shortcutIds.map((shortcutId, index) => {
    const shortcut = WORKSPACE_QUICK_LINKS.find((item) => item.id === shortcutId);

    if (!shortcut) {
      throw new Error(`Unknown shortcut id: ${shortcutId}`);
    }

    const icon = matchIcon(shortcutId, icons);

    if (!icon) {
      throw new Error(
        `Unable to map "${localizeWorkspaceText(shortcut.title, locale)}" to a backend icon.`,
      );
    }

    return {
      name: localizeWorkspaceText(shortcut.title, locale),
      siteUrl: shortcut.href,
      iconId: icon.id,
      position: calculateGridPosition(template.shortcutIds, index),
      size: {
        width: shortcut.wide ? 3 : 2,
        height: 1,
      },
    } satisfies TemplateItemRequest;
  });

  return {
    templateId: template.serverTemplateId ?? 0,
    name: template.name,
    height: 6,
    items,
  };
}
