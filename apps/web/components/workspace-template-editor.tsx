"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@linku/ui";
import {
  WORKSPACE_ICON_NAMES,
  WORKSPACE_QUICK_LINKS,
  localizeWorkspaceText,
  normalizeExternalHttpUrl,
  type WorkspaceCustomShortcut,
  type WorkspaceIconName,
} from "@linku/platform";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { WorkspaceShortcutGrid } from "@/components/workspace-shortcut-grid";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";
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
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [customIcon, setCustomIcon] =
    useState<WorkspaceIconName>("University");
  const [customWide, setCustomWide] = useState(false);
  const [customError, setCustomError] = useState("");

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

  function openCustomShortcutEditor(shortcut?: WorkspaceCustomShortcut) {
    setEditingCustomId(shortcut?.id ?? null);
    setCustomName(shortcut?.name ?? "");
    setCustomHref(shortcut?.href ?? "");
    setCustomIcon(shortcut?.icon ?? "University");
    setCustomWide(shortcut?.wide ?? false);
    setCustomError("");
    setCustomDialogOpen(true);
  }

  function saveCustomShortcut() {
    if (!template || !customName.trim() || !customHref.trim()) {
      setCustomError(
        locale === "ko"
          ? "이름과 URL을 모두 입력해 주세요."
          : "Enter both a name and URL.",
      );
      return;
    }

    const normalizedHref = normalizeExternalHttpUrl(customHref);
    if (!normalizedHref) {
      setCustomError(
        locale === "ko"
          ? "http 또는 https로 시작하는 올바른 URL을 입력해 주세요."
          : "Enter a valid URL beginning with http or https.",
      );
      return;
    }

    const id = editingCustomId ?? `custom-shortcut-${Date.now()}`;
    const nextShortcut: WorkspaceCustomShortcut = {
      id,
      name: customName.trim(),
      href: normalizedHref,
      icon: customIcon,
      wide: customWide,
    };
    const currentCustomShortcuts = template.customShortcuts ?? [];
    const nextCustomShortcuts = editingCustomId
      ? currentCustomShortcuts.map((item) =>
          item.id === editingCustomId ? nextShortcut : item,
        )
      : [...currentCustomShortcuts, nextShortcut];

    updateTemplate({
      customShortcuts: nextCustomShortcuts,
      shortcutIds: editingCustomId
        ? template.shortcutIds
        : [...template.shortcutIds, id],
    });
    setCustomDialogOpen(false);
  }

  function removeShortcut(id: string) {
    if (!template) {
      return;
    }

    updateTemplate({
      shortcutIds: template.shortcutIds.filter((item) => item !== id),
      customShortcuts: template.customShortcuts?.filter(
        (item) => item.id !== id,
      ),
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
    <div className="flex flex-col gap-8">
      <WorkspacePageHeading
        eyebrow={templateId ? copy.templates.editorTitleEdit : copy.templates.editorTitleNew}
        title={template.name}
        description={copy.templates.description}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>{copy.templates.editorName}</Label>
          <Input
            value={template.name}
            onChange={(event) => updateTemplate({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label>{copy.templates.editorDescription}</Label>
          <Input
            value={template.description}
            onChange={(event) => updateTemplate({ description: event.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{copy.templates.availableShortcuts}</CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={() => openCustomShortcutEditor()}
            >
              <Plus className="size-4" />
              {locale === "ko" ? "직접 추가" : "Custom link"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {availableShortcuts.map((shortcut) => (
              <article
                key={shortcut.id}
                className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-4"
              >
                <div>
                  <h3 className="font-medium">
                    {localizeWorkspaceText(shortcut.title, locale)}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {localizeWorkspaceText(shortcut.description, locale)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addShortcut(shortcut.id)}
                >
                  <Plus className="size-4" />
                  {copy.templates.addShortcut}
                </Button>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.templates.selectedShortcuts}</CardTitle>
          </CardHeader>
          <CardContent>
          {template.shortcutIds.length === 0 ? (
            <p className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
              {locale === "ko"
                ? "오른쪽 미리보기에 표시할 바로가기를 추가해 주세요."
                : "Add shortcuts to populate the preview."}
            </p>
          ) : (
            <div className="grid gap-3">
              {template.shortcutIds.map((shortcutId) => {
                const shortcut = WORKSPACE_QUICK_LINKS.find((item) => item.id === shortcutId);
                const customShortcut = template.customShortcuts?.find(
                  (item) => item.id === shortcutId,
                );
                if (!shortcut && !customShortcut) {
                  return null;
                }

                return (
                  <article
                    key={shortcutId}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium">
                        {customShortcut?.name ??
                          (shortcut
                            ? localizeWorkspaceText(shortcut.title, locale)
                            : "")}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {customShortcut?.href ??
                          (shortcut
                            ? localizeWorkspaceText(
                                shortcut.description,
                                locale,
                              )
                            : "")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {customShortcut ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={locale === "ko" ? "수정" : "Edit"}
                          onClick={() =>
                            openCustomShortcutEditor(customShortcut)
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveShortcut(shortcutId, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveShortcut(shortcutId, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeShortcut(shortcutId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{locale === "ko" ? "미리보기" : "Preview"}</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceShortcutGrid
            shortcutIds={template.shortcutIds}
            customShortcuts={template.customShortcuts}
            locale={locale}
            compact
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSave(false)}
        >
          {copy.templates.editorSave}
        </Button>
        <Button type="button" onClick={() => handleSave(true)}>
          {copy.templates.editorSaveAndApply}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/templates")}
        >
          {copy.templates.editorCancel}
        </Button>
      </div>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomId
                ? locale === "ko"
                  ? "직접 만든 바로가기 수정"
                  : "Edit custom shortcut"
                : locale === "ko"
                  ? "바로가기 직접 추가"
                  : "Add a custom shortcut"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ko"
                ? "확장 프로그램 편집기처럼 이름, URL, 아이콘과 타일 너비를 정합니다."
                : "Choose a name, URL, icon, and tile width as you would in the extension editor."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-shortcut-name">
                {locale === "ko" ? "이름" : "Name"}
              </Label>
              <Input
                id="custom-shortcut-name"
                value={customName}
                maxLength={15}
                onChange={(event) => setCustomName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-shortcut-url">URL</Label>
              <Input
                id="custom-shortcut-url"
                type="url"
                value={customHref}
                placeholder="https://"
                onChange={(event) => setCustomHref(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-shortcut-icon">
                {locale === "ko" ? "아이콘" : "Icon"}
              </Label>
              <select
                id="custom-shortcut-icon"
                className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={customIcon}
                onChange={(event) =>
                  setCustomIcon(event.target.value as WorkspaceIconName)
                }
              >
                {WORKSPACE_ICON_NAMES.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={customWide}
                onChange={(event) => setCustomWide(event.target.checked)}
              />
              {locale === "ko" ? "넓은 타일로 표시" : "Use a wide tile"}
            </label>
            {customError ? (
              <p className="text-sm text-destructive">{customError}</p>
            ) : null}
            <Button type="button" onClick={saveCustomShortcut}>
              {editingCustomId
                ? locale === "ko"
                  ? "수정 저장"
                  : "Save changes"
                : locale === "ko"
                  ? "추가"
                  : "Add shortcut"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
