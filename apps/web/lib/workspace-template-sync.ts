import type { Icon, TemplateItemRequest } from "@linku/shared-types";
import {
  WORKSPACE_QUICK_LINKS,
  localizeWorkspaceText,
  type WorkspaceIconName,
  type WorkspaceLocale,
} from "@linku/platform";
import type { WorkspaceTemplateRecord } from "@/lib/workspace-templates";

function resolveTemplateShortcut(
  template: WorkspaceTemplateRecord,
  shortcutId: string,
) {
  const catalogShortcut = WORKSPACE_QUICK_LINKS.find(
    (item) => item.id === shortcutId,
  );
  if (catalogShortcut) {
    return {
      id: catalogShortcut.id,
      name: catalogShortcut.title,
      href: catalogShortcut.href,
      icon: catalogShortcut.icon,
      wide: catalogShortcut.wide,
    };
  }

  const customShortcut = template.customShortcuts?.find(
    (item) => item.id === shortcutId,
  );
  return customShortcut
    ? {
        id: customShortcut.id,
        name: { ko: customShortcut.name, en: customShortcut.name },
        href: customShortcut.href,
        icon: customShortcut.icon,
        wide: customShortcut.wide,
      }
    : null;
}

function calculateGridPosition(
  template: WorkspaceTemplateRecord,
  targetIndex: number,
) {
  let currentColumn = 0;
  let currentRow = 0;

  for (let index = 0; index < targetIndex; index += 1) {
    const shortcut = resolveTemplateShortcut(
      template,
      template.shortcutIds[index],
    );
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

  const currentShortcut = resolveTemplateShortcut(
    template,
    template.shortcutIds[targetIndex],
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

function matchIcon(
  shortcut: NonNullable<ReturnType<typeof resolveTemplateShortcut>>,
  icons: Icon[],
) {
  if (!shortcut) {
    return null;
  }

  const normalizedName = normalize(shortcut.icon);
  const normalizedKoTitle = normalize(localizeWorkspaceText(shortcut.name, "ko"));
  const normalizedEnTitle = normalize(localizeWorkspaceText(shortcut.name, "en"));
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
    const shortcut = resolveTemplateShortcut(template, shortcutId);

    if (!shortcut) {
      throw new Error(`Unknown shortcut id: ${shortcutId}`);
    }

    const icon = matchIcon(shortcut, icons);

    if (!icon) {
      throw new Error(
        `Unable to map "${localizeWorkspaceText(shortcut.name, locale)}" to a backend icon.`,
      );
    }

    return {
      name: localizeWorkspaceText(shortcut.name, locale),
      siteUrl: shortcut.href,
      iconId: icon.id,
      position: calculateGridPosition(template, index),
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
