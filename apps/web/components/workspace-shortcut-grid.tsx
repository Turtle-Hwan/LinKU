"use client";

import {
  WORKSPACE_QUICK_LINKS,
  localizeWorkspaceText,
  type WorkspaceCustomShortcut,
} from "@linku/platform";
import { Button, ShortcutGrid, ShortcutTile } from "@linku/ui";
import { WorkspaceShortcutIcon } from "@/components/workspace-shortcut-icon";
import type { AppLocale } from "@/i18n/routing";

interface WorkspaceShortcutGridProps {
  shortcutIds: string[];
  locale: AppLocale;
  compact?: boolean;
  customShortcuts?: readonly WorkspaceCustomShortcut[];
}

export function WorkspaceShortcutGrid({
  shortcutIds,
  locale,
  compact = false,
  customShortcuts = [],
}: WorkspaceShortcutGridProps) {
  const customShortcutMap = new Map(
    customShortcuts.map((shortcut) => [shortcut.id, shortcut]),
  );
  const shortcuts = shortcutIds
    .map((id) => {
      const catalogShortcut = WORKSPACE_QUICK_LINKS.find(
        (item) => item.id === id,
      );
      if (catalogShortcut) {
        return {
          id: catalogShortcut.id,
          icon: catalogShortcut.icon,
          title: localizeWorkspaceText(catalogShortcut.title, locale),
          href: catalogShortcut.href,
          wide: catalogShortcut.wide,
          actions: catalogShortcut.actions,
        };
      }

      const customShortcut = customShortcutMap.get(id);
      return customShortcut
        ? {
            id: customShortcut.id,
            icon: customShortcut.icon,
            title: customShortcut.name,
            href: customShortcut.href,
            wide: customShortcut.wide,
            actions: undefined,
          }
        : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  return (
    <ShortcutGrid className="Link__Grid mt-0 grid-cols-4 gap-4 p-4 sm:grid-cols-6 sm:gap-3 sm:p-3">
      {shortcuts.map((shortcut) => {
        const tile = (
          <ShortcutTile
            wide={shortcut.wide}
            className={
              !compact && shortcut.actions?.length
                ? "col-span-1 w-full"
                : shortcut.wide
                  ? "col-span-2 sm:col-span-3"
                  : "col-span-2"
            }
            href={shortcut.href}
            target="_blank"
            rel="noreferrer"
            icon={
              <WorkspaceShortcutIcon
                icon={shortcut.icon}
                className="Icon__Animation size-5"
              />
            }
            label={shortcut.title}
          />
        );

        if (!compact && shortcut.actions?.length) {
          return (
            <div
              key={shortcut.id}
              className={`${
                shortcut.wide
                  ? "col-span-2 sm:col-span-3"
                  : "col-span-2"
              } grid gap-1.5`}
            >
              {tile}
              <div className="flex gap-1.5">
                {shortcut.actions.map((action) => (
                  <Button
                    key={action.id}
                    asChild
                    size="sm"
                    variant={action.recommendedFor === "extension" ? "default" : "secondary"}
                    className={`h-7 flex-1 px-2 text-xs ${
                      action.recommendedFor === "extension"
                        ? "bg-main text-white hover:bg-hover"
                        : ""
                    }`}
                  >
                    <a href={action.href} target="_blank" rel="noreferrer">
                      {localizeWorkspaceText(action.label, locale)}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          );
        }

        return <div key={shortcut.id} className="contents">{tile}</div>;
      })}
    </ShortcutGrid>
  );
}
