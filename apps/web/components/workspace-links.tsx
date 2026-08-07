"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, CardContent, Input } from "@linku/ui";
import type { Template } from "@linku/shared-types";
import { WorkspaceBannerCarousel } from "@/components/workspace-banner-carousel";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";
import { WorkspaceTemplateGrid } from "@/components/workspace-template-grid";
import type { AppLocale } from "@/i18n/routing";
import { getRemoteTemplate } from "@/lib/remote-template-client";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  getSelectedWorkspaceTemplateSelection,
  listWorkspaceTemplates,
} from "@/lib/workspace-templates";

export function WorkspaceLinks({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteTemplateDetail, setRemoteTemplateDetail] = useState<{
    templateId: number;
    template: Template;
  } | null>(null);
  const selection = useMemo(
    () => getSelectedWorkspaceTemplateSelection(locale),
    [locale],
  );

  const activeTemplate = useMemo(() => {
    const allTemplates = listWorkspaceTemplates(locale);
    return selection.kind === "local"
      ? allTemplates.find((item) => item.id === selection.templateId) ??
          allTemplates[0] ??
          null
      : null;
  }, [locale, selection]);

  const remoteTemplate = useMemo(() => {
    if (selection.kind !== "remote") {
      return null;
    }

    if (
      remoteTemplateDetail &&
      remoteTemplateDetail.templateId === selection.templateId
    ) {
      return remoteTemplateDetail.template;
    }

    if (selection.cachedItems && selection.cachedItems.length > 0) {
      return {
        id: `remote-${selection.templateId}`,
        templateId: selection.templateId,
        name: selection.cachedName || "Remote template",
        height: selection.cachedHeight || 6,
        cloned: false,
        items: selection.cachedItems,
        createdAt: "",
        updatedAt: "",
      } satisfies Template;
    }

    return null;
  }, [remoteTemplateDetail, selection]);

  useEffect(() => {
    if (selection.kind !== "remote") {
      return;
    }

    void getRemoteTemplate(selection.templateId)
      .then((template) => {
        setRemoteTemplateDetail({
          templateId: selection.templateId,
          template,
        });
      })
      .catch(() => {
        // The cached template remains available while the backend is offline.
      });
  }, [selection]);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-white"
      aria-label={copy.workspace.tabs.shortcuts}
    >
      <form
        className="relative p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!searchQuery.trim()) {
            return;
          }

          window.open(
            `https://search.konkuk.ac.kr/main.do?keyword=${encodeURIComponent(searchQuery.trim())}`,
            "_blank",
            "noopener,noreferrer",
          );
        }}
      >
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={copy.workspace.searchPlaceholder}
          className="w-full pl-9"
        />
        <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground sm:left-7" />
        <Button type="submit" size="icon" variant="ghost" className="sr-only">
          {copy.workspace.searchAction}
        </Button>
      </form>

      {selection.kind === "remote" && remoteTemplate ? (
        <div className="border-t p-3">
          <WorkspaceTemplateGrid
            items={remoteTemplate.items}
            rows={remoteTemplate.height}
            interactive
          />
        </div>
      ) : selection.kind === "remote" ? (
        <Card size="sm" className="rounded-none border-x-0 border-b-0">
          <CardContent className="text-sm text-muted-foreground">
            {locale === "ko"
              ? "템플릿을 동기화하는 중입니다."
              : "Syncing the template."}
          </CardContent>
        </Card>
      ) : activeTemplate ? (
        <WorkspaceShortcutGrid
          shortcutIds={activeTemplate.shortcutIds}
          customShortcuts={activeTemplate.customShortcuts}
          locale={locale}
        />
      ) : null}

      <WorkspaceBannerCarousel locale={locale} />
    </section>
  );
}
