"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@linku/ui";
import type { Template } from "@linku/shared-types";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { WorkspaceAlerts } from "@/components/workspace-alerts";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";
import { WorkspaceTemplateGrid } from "@/components/workspace-template-grid";
import { WorkspaceTodos } from "@/components/workspace-todos";
import { getLabsCopy } from "@/lib/labs-copy";
import { getRemoteTemplate } from "@/lib/remote-template-client";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  getSelectedWorkspaceTemplateSelection,
  listWorkspaceTemplates,
} from "@/lib/workspace-templates";

export function WebWorkspace({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const labsCopy = getLabsCopy(locale);
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteTemplateDetail, setRemoteTemplateDetail] = useState<{
    templateId: number;
    template: Template;
  } | null>(null);
  const selection = useMemo(
    () => getSelectedWorkspaceTemplateSelection(locale),
    [locale],
  );

  const { templates, activeTemplate } = useMemo(() => {
    const allTemplates = listWorkspaceTemplates(locale);
    const selectedTemplate =
      selection.kind === "local"
        ? allTemplates.find((item) => item.id === selection.templateId) ?? allTemplates[0] ?? null
        : null;

    return {
      templates: allTemplates,
      activeTemplate: selectedTemplate,
    };
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
        // Keep the cached template if the latest fetch fails.
      });
  }, [selection]);

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

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
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
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/labs">{locale === "ko" ? "Labs 열기" : "Open Labs"}</Link>
          </Button>
        </div>
      </section>

      <Tabs defaultValue="shortcuts" className="space-y-6">
        <TabsList className="h-auto flex-wrap rounded-[1.2rem] border border-black/8 bg-white p-2">
          <TabsTrigger value="shortcuts">{copy.workspace.tabs.shortcuts}</TabsTrigger>
          <TabsTrigger value="alerts">{copy.workspace.tabs.alerts}</TabsTrigger>
          <TabsTrigger value="todos">{copy.workspace.tabs.todos}</TabsTrigger>
          <TabsTrigger value="timetable">{labsCopy.timetable.title}</TabsTrigger>
          <TabsTrigger value="templates">{copy.workspace.tabs.templates}</TabsTrigger>
        </TabsList>

        <TabsContent value="shortcuts" className="space-y-5">
          {selection.kind === "remote" && remoteTemplate ? (
            <>
              <WorkspaceTemplateCard
                template={{
                  name: remoteTemplate.name,
                  description:
                    locale === "ko"
                      ? "LinKU backend 템플릿이 웹 대시보드에 적용된 상태입니다."
                      : "A LinKU backend template is currently applied on the web dashboard.",
                }}
                locale={locale}
                active
                badges={[locale === "ko" ? "현재 대시보드 구성" : "Current dashboard set"]}
                preview={<WorkspaceTemplateGrid items={remoteTemplate.items} rows={remoteTemplate.height} />}
                itemCount={remoteTemplate.items.length}
              />
              {remoteTemplate === null ? (
                <div className="rounded-[1.2rem] border border-black/8 bg-white p-5 text-sm text-[var(--muted)]">
                  {locale === "ko" ? "remote template을 동기화하는 중입니다." : "Syncing the remote template."}
                </div>
              ) : null}
              <WorkspaceTemplateGrid items={remoteTemplate.items} rows={remoteTemplate.height} interactive />
            </>
          ) : activeTemplate ? (
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

        <TabsContent value="timetable">
          <div className="rounded-[1.6rem] border border-dashed border-black/10 bg-white/70 p-6">
            <h3 className="text-2xl tracking-[-0.04em]">{labsCopy.timetable.title}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              {labsCopy.timetable.body}
            </p>
            <div className="mt-5">
              <Button asChild variant="secondary" className="rounded-full">
                <Link href="/labs">{locale === "ko" ? "보조 도구 열기" : "Open tools"}</Link>
              </Button>
            </div>
          </div>
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
