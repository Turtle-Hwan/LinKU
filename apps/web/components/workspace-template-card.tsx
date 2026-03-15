"use client";

import { Badge, Button } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import type { WorkspaceTemplateRecord } from "@/lib/workspace-templates";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";

interface WorkspaceTemplateCardProps {
  template: WorkspaceTemplateRecord;
  locale: AppLocale;
  active?: boolean;
  badges?: string[];
  actions?: React.ReactNode;
}

export function WorkspaceTemplateCard({
  template,
  locale,
  active = false,
  badges = [],
  actions,
}: WorkspaceTemplateCardProps) {
  return (
    <article className="rounded-[1.6rem] border border-black/8 bg-white p-5 shadow-[0_20px_50px_rgba(19,42,34,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl tracking-[-0.04em]">{template.name}</h3>
            {active ? <Badge>{locale === "ko" ? "현재 적용 중" : "Active"}</Badge> : null}
            {badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {template.description}
          </p>
        </div>

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="mt-5">
        <WorkspaceShortcutGrid shortcutIds={template.shortcutIds} locale={locale} compact />
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" className="rounded-full text-xs text-[var(--muted)]">
          {locale === "ko"
            ? `${template.shortcutIds.length}개 바로가기`
            : `${template.shortcutIds.length} shortcuts`}
        </Button>
      </div>
    </article>
  );
}
