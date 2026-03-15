"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@linku/ui";
import { WORKSPACE_QUICK_LINKS, localizeWorkspaceText } from "@linku/platform";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";
import { getWorkspaceCopy } from "@/lib/workspace-copy";
import {
  createWorkspaceTemplate,
  getWorkspaceTemplateById,
  saveWorkspaceTemplate,
  setSelectedWorkspaceTemplateId,
  type WorkspaceTemplateRecord,
} from "@/lib/workspace-templates";

interface WorkspaceTemplateEditorProps {
  locale: AppLocale;
  templateId?: string;
  source?: "empty" | "default";
}

export function WorkspaceTemplateEditor({
  locale,
  templateId,
  source = "empty",
}: WorkspaceTemplateEditorProps) {
  const copy = getWorkspaceCopy(locale);
  const router = useRouter();
  const [template, setTemplate] = useState<WorkspaceTemplateRecord | null>(() =>
    templateId
      ? getWorkspaceTemplateById(templateId, locale)
      : createWorkspaceTemplate(locale, source),
  );

  const availableShortcuts = useMemo(
    () =>
      WORKSPACE_QUICK_LINKS.filter(
        (item) => !template?.shortcutIds.includes(item.id),
      ),
    [template?.shortcutIds],
  );

  function updateTemplate(changes: Partial<WorkspaceTemplateRecord>) {
    if (!template) {
      return;
    }

    setTemplate({
      ...template,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  function addShortcut(id: string) {
    if (!template || template.shortcutIds.includes(id)) {
      return;
    }

    updateTemplate({
      shortcutIds: [...template.shortcutIds, id],
    });
  }

  function removeShortcut(id: string) {
    if (!template) {
      return;
    }

    updateTemplate({
      shortcutIds: template.shortcutIds.filter((item) => item !== id),
    });
  }

  function moveShortcut(id: string, direction: -1 | 1) {
    if (!template) {
      return;
    }

    const index = template.shortcutIds.findIndex((item) => item === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= template.shortcutIds.length) {
      return;
    }

    const nextShortcutIds = [...template.shortcutIds];
    [nextShortcutIds[index], nextShortcutIds[nextIndex]] = [
      nextShortcutIds[nextIndex],
      nextShortcutIds[index],
    ];

    updateTemplate({ shortcutIds: nextShortcutIds });
  }

  function handleSave(applyAfterSave: boolean) {
    if (!template) {
      return;
    }

    const savedTemplate = saveWorkspaceTemplate({
      ...template,
      source: "custom",
      syncStatus: template.serverTemplateId ? "local" : (template.syncStatus ?? "local"),
      postedTemplateId: template.serverTemplateId ? undefined : template.postedTemplateId,
      updatedAt: new Date().toISOString(),
    });

    if (applyAfterSave) {
      setSelectedWorkspaceTemplateId(savedTemplate.id);
    }

    router.push(applyAfterSave ? "/dashboard" : "/templates");
  }

  if (!template) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {templateId ? copy.templates.editorTitleEdit : copy.templates.editorTitleNew}
        </p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          {template.name}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">{copy.templates.editorName}</label>
          <Input
            value={template.name}
            onChange={(event) => updateTemplate({ name: event.target.value })}
            className="rounded-full bg-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{copy.templates.editorDescription}</label>
          <Input
            value={template.description}
            onChange={(event) => updateTemplate({ description: event.target.value })}
            className="rounded-full bg-white"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-[1.8rem] border border-black/8 bg-white p-6">
          <h2 className="text-2xl tracking-[-0.04em]">{copy.templates.availableShortcuts}</h2>
          <div className="mt-5 grid gap-3">
            {availableShortcuts.map((shortcut) => (
              <article
                key={shortcut.id}
                className="flex items-center justify-between gap-4 rounded-[1rem] border border-black/8 bg-[#f6f0e1] p-4"
              >
                <div>
                  <h3 className="text-lg tracking-[-0.03em]">
                    {localizeWorkspaceText(shortcut.title, locale)}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {localizeWorkspaceText(shortcut.description, locale)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => addShortcut(shortcut.id)}
                >
                  <Plus className="size-4" />
                  {copy.templates.addShortcut}
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-black/8 bg-white p-6">
          <h2 className="text-2xl tracking-[-0.04em]">{copy.templates.selectedShortcuts}</h2>
          {template.shortcutIds.length === 0 ? (
            <p className="mt-5 rounded-[1rem] border border-dashed border-black/10 bg-[#f6f0e1] p-5 text-sm text-[var(--muted)]">
              {locale === "ko"
                ? "오른쪽 미리보기에 표시할 바로가기를 추가해 주세요."
                : "Add shortcuts to populate the preview."}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {template.shortcutIds.map((shortcutId) => {
                const shortcut = WORKSPACE_QUICK_LINKS.find((item) => item.id === shortcutId);
                if (!shortcut) {
                  return null;
                }

                return (
                  <article
                    key={shortcut.id}
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-black/8 bg-[#f6f0e1] p-4"
                  >
                    <div>
                      <h3 className="text-lg tracking-[-0.03em]">
                        {localizeWorkspaceText(shortcut.title, locale)}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {localizeWorkspaceText(shortcut.description, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveShortcut(shortcut.id, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveShortcut(shortcut.id, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeShortcut(shortcut.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[1.8rem] border border-black/8 bg-white p-6">
        <h2 className="text-2xl tracking-[-0.04em]">
          {locale === "ko" ? "미리보기" : "Preview"}
        </h2>
        <div className="mt-5">
          <WorkspaceShortcutGrid shortcutIds={template.shortcutIds} locale={locale} compact />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          className="rounded-full"
          onClick={() => handleSave(false)}
        >
          {copy.templates.editorSave}
        </Button>
        <Button type="button" className="rounded-full" onClick={() => handleSave(true)}>
          {copy.templates.editorSaveAndApply}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => router.push("/templates")}
        >
          {copy.templates.editorCancel}
        </Button>
      </div>
    </div>
  );
}
