"use client";

import { useMemo, useState } from "react";
import { Button, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { WorkspaceAlerts } from "@/components/workspace-alerts";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";
import { WorkspaceTodos } from "@/components/workspace-todos";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  getSelectedWorkspaceTemplateId,
  listWorkspaceTemplates,
} from "@/lib/workspace-templates";

export function WebWorkspace({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [searchQuery, setSearchQuery] = useState("");

  const { templates, activeTemplate } = useMemo(() => {
    const allTemplates = listWorkspaceTemplates(locale);
    const selectedId = getSelectedWorkspaceTemplateId(locale);
    const selectedTemplate =
      allTemplates.find((item) => item.id === selectedId) ?? allTemplates[0] ?? null;

    return {
      templates: allTemplates,
      activeTemplate: selectedTemplate,
    };
  }, [locale]);

  return (
    <div className="space-y-8">
      <section className="rounded-[1.8rem] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(19,42,34,0.05)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.workspace.heroEyebrow}
        </p>
        <h1 data-display="true" className="mt-3 text-5xl tracking-[-0.05em]">
          {copy.workspace.heroTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {copy.workspace.heroBody}
        </p>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <form
            className="flex gap-2"
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
              className="rounded-full bg-[#f6f0e1]"
            />
            <Button type="submit" variant="secondary" className="rounded-full">
              {copy.workspace.searchAction}
            </Button>
          </form>

          <Button asChild variant="outline" className="rounded-full">
            <Link href="/intro">{copy.workspace.openIntro}</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/templates">{copy.workspace.openTemplates}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/gallery">{copy.workspace.openGallery}</Link>
          </Button>
        </div>
      </section>

      <Tabs defaultValue="shortcuts" className="space-y-6">
        <TabsList className="h-auto flex-wrap rounded-[1.2rem] border border-black/8 bg-white p-2">
          <TabsTrigger value="shortcuts">{copy.workspace.tabs.shortcuts}</TabsTrigger>
          <TabsTrigger value="alerts">{copy.workspace.tabs.alerts}</TabsTrigger>
          <TabsTrigger value="todos">{copy.workspace.tabs.todos}</TabsTrigger>
          <TabsTrigger value="templates">{copy.workspace.tabs.templates}</TabsTrigger>
        </TabsList>

        <TabsContent value="shortcuts" className="space-y-5">
          {activeTemplate ? (
            <>
              <WorkspaceTemplateCard
                template={activeTemplate}
                locale={locale}
                active
                badges={[locale === "ko" ? "현재 대시보드 구성" : "Current dashboard set"]}
              />
              <WorkspaceShortcutGrid shortcutIds={activeTemplate.shortcutIds} locale={locale} />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="alerts">
          <WorkspaceAlerts locale={locale} />
        </TabsContent>

        <TabsContent value="todos">
          <WorkspaceTodos locale={locale} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-5">
          <div className="grid gap-5">
            {templates.slice(0, 3).map((template) => (
              <WorkspaceTemplateCard
                key={template.id}
                template={template}
                locale={locale}
                active={activeTemplate?.id === template.id}
                badges={[
                  template.source === "default"
                    ? locale === "ko"
                      ? "기본"
                      : "Default"
                    : locale === "ko"
                      ? "사용자"
                      : "Custom",
                ]}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/templates">{copy.workspace.openTemplates}</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/gallery">{copy.workspace.openGallery}</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
