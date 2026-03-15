"use client";

import { useState } from "react";
import { Button } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  cloneWorkspaceTemplate,
  deleteWorkspaceTemplate,
  getSelectedWorkspaceTemplateSelection,
  listWorkspaceTemplates,
  setSelectedWorkspaceTemplateSelection,
  type WorkspaceTemplateRecord,
} from "@/lib/workspace-templates";
import { WorkspaceTemplateCard } from "@/components/workspace-template-card";

function badgeForTemplate(template: WorkspaceTemplateRecord, locale: AppLocale) {
  if (template.source === "default") {
    return locale === "ko" ? "기본" : "Default";
  }

  if (template.source === "gallery") {
    return locale === "ko" ? "갤러리" : "Gallery";
  }

  return locale === "ko" ? "사용자" : "Custom";
}

export function WorkspaceLocalTemplateManager({ locale }: { locale: AppLocale }) {
  const copy = getWorkspaceCopy(locale);
  const [state, setState] = useState(() => {
    const selection = getSelectedWorkspaceTemplateSelection(locale);

    return {
      templates: listWorkspaceTemplates(locale),
      selectedTemplateId: selection.kind === "local" ? selection.templateId : null,
    };
  });

  function refresh() {
    const selection = getSelectedWorkspaceTemplateSelection(locale);

    setState({
      templates: listWorkspaceTemplates(locale),
      selectedTemplateId: selection.kind === "local" ? selection.templateId : null,
    });
  }

  const { templates, selectedTemplateId } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 data-display="true" className="text-4xl tracking-[-0.05em]">
            {locale === "ko" ? "웹 로컬 템플릿" : "Web local templates"}
          </h2>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            {copy.templates.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/gallery">{copy.templates.galleryTitle}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/editor?source=empty">{copy.templates.createEmpty}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/editor?source=default">{copy.templates.createDefault}</Link>
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-[1.2rem] border border-dashed border-black/15 bg-white/70 p-5 text-sm leading-7 text-[var(--muted)]">
          {copy.templates.empty}
        </p>
      ) : (
        <div className="grid gap-5">
          {templates.map((template) => (
            <WorkspaceTemplateCard
              key={template.id}
              template={template}
              locale={locale}
              active={selectedTemplateId === template.id}
              badges={[badgeForTemplate(template, locale)]}
              actions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setSelectedWorkspaceTemplateSelection({
                        kind: "local",
                        templateId: template.id,
                      });
                      refresh();
                    }}
                  >
                    {copy.templates.apply}
                  </Button>
                  {template.source === "custom" ? (
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={`/editor/${template.id}`}>{copy.templates.edit}</Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      cloneWorkspaceTemplate(template, locale);
                      refresh();
                    }}
                  >
                    {copy.templates.duplicate}
                  </Button>
                  {template.source === "custom" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => {
                        deleteWorkspaceTemplate(template.id);
                        refresh();
                      }}
                    >
                      {copy.templates.remove}
                    </Button>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
