"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";
import type { WorkspaceCustomShortcut } from "@linku/platform";

interface WorkspaceTemplateCardData {
  name: string;
  description: string;
  shortcutIds?: string[];
  customShortcuts?: WorkspaceCustomShortcut[];
}

interface WorkspaceTemplateCardProps {
  template: WorkspaceTemplateCardData;
  locale: AppLocale;
  active?: boolean;
  badges?: string[];
  actions?: React.ReactNode;
  preview?: React.ReactNode;
  itemCount?: number;
}

export function WorkspaceTemplateCard({
  template,
  locale,
  active = false,
  badges = [],
  actions,
  preview,
  itemCount,
}: WorkspaceTemplateCardProps) {
  const resolvedItemCount = itemCount ?? template.shortcutIds?.length ?? 0;

  return (
    <Card>
      <CardHeader className="gap-4 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{template.name}</CardTitle>
            {active ? <Badge>{locale === "ko" ? "현재 적용 중" : "Active"}</Badge> : null}
            {badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </div>
          <CardDescription className="max-w-3xl leading-7">
            {template.description}
          </CardDescription>
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardHeader>

      <CardContent>
        {preview ? (
          preview
        ) : (
          <WorkspaceShortcutGrid
            shortcutIds={template.shortcutIds ?? []}
            customShortcuts={template.customShortcuts}
            locale={locale}
            compact
          />
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          {locale === "ko"
            ? `${resolvedItemCount}개 바로가기`
            : `${resolvedItemCount} shortcuts`}
        </Button>
      </CardFooter>
    </Card>
  );
}
