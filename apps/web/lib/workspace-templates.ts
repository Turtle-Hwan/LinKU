import {
  DEFAULT_WORKSPACE_TEMPLATE,
  WORKSPACE_ICON_NAMES,
  WORKSPACE_TEMPLATE_PRESETS,
  localizeWorkspaceText,
  type WorkspaceCustomShortcut,
  type WorkspaceLocale,
  type WorkspaceTemplatePreset,
} from "@linku/platform";
import type { TemplateItem } from "@linku/shared-types";

export interface WorkspaceTemplateRecord {
  id: string;
  name: string;
  description: string;
  shortcutIds: string[];
  customShortcuts?: WorkspaceCustomShortcut[];
  source: "default" | "custom" | "gallery";
  serverTemplateId?: number;
  syncStatus?: "local" | "synced";
  postedTemplateId?: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "linku.web.templates.v1";
const SELECTED_TEMPLATE_KEY = "linku.web.selected-template.v1";
const SELECTED_TEMPLATE_TARGET_KEY = "linku.web.selected-template-target.v1";

export type WorkspaceTemplateSelection =
  | {
      kind: "local";
      templateId: string;
    }
  | {
      kind: "remote";
      templateId: number;
      cachedName?: string;
      cachedDescription?: string;
      cachedHeight?: number;
      cachedItems?: TemplateItem[];
    };

function isCustomShortcut(value: unknown): value is WorkspaceCustomShortcut {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as WorkspaceCustomShortcut).id === "string" &&
    typeof (value as WorkspaceCustomShortcut).name === "string" &&
    typeof (value as WorkspaceCustomShortcut).href === "string" &&
    WORKSPACE_ICON_NAMES.includes((value as WorkspaceCustomShortcut).icon) &&
    (typeof (value as WorkspaceCustomShortcut).wide === "boolean" ||
      (value as WorkspaceCustomShortcut).wide === undefined)
  );
}

function isTemplateRecord(value: unknown): value is WorkspaceTemplateRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as WorkspaceTemplateRecord).id === "string" &&
    typeof (value as WorkspaceTemplateRecord).name === "string" &&
    typeof (value as WorkspaceTemplateRecord).description === "string" &&
    Array.isArray((value as WorkspaceTemplateRecord).shortcutIds) &&
    (Array.isArray((value as WorkspaceTemplateRecord).customShortcuts)
      ? Boolean(
          (value as WorkspaceTemplateRecord).customShortcuts?.every(
            isCustomShortcut,
          ),
        )
      : (value as WorkspaceTemplateRecord).customShortcuts === undefined) &&
    typeof (value as WorkspaceTemplateRecord).source === "string" &&
    (typeof (value as WorkspaceTemplateRecord).serverTemplateId === "number" ||
      (value as WorkspaceTemplateRecord).serverTemplateId === undefined) &&
    ((value as WorkspaceTemplateRecord).syncStatus === "local" ||
      (value as WorkspaceTemplateRecord).syncStatus === "synced" ||
      (value as WorkspaceTemplateRecord).syncStatus === undefined) &&
    (typeof (value as WorkspaceTemplateRecord).postedTemplateId === "number" ||
      (value as WorkspaceTemplateRecord).postedTemplateId === undefined) &&
    typeof (value as WorkspaceTemplateRecord).createdAt === "string" &&
    typeof (value as WorkspaceTemplateRecord).updatedAt === "string"
  );
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isTemplateSelection(value: unknown): value is WorkspaceTemplateSelection {
  return (
    typeof value === "object" &&
    value !== null &&
    ((((value as WorkspaceTemplateSelection).kind === "local" &&
      typeof (value as WorkspaceTemplateSelection & { templateId?: unknown }).templateId ===
        "string") ||
      ((value as WorkspaceTemplateSelection).kind === "remote" &&
        typeof (value as WorkspaceTemplateSelection & { templateId?: unknown }).templateId ===
          "number")))
  );
}

function readStorageTemplates(): WorkspaceTemplateRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isTemplateRecord) : [];
  } catch {
    return [];
  }
}

function writeStorageTemplates(templates: WorkspaceTemplateRecord[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function createRecordFromPreset(
  preset: WorkspaceTemplatePreset,
  locale: WorkspaceLocale,
  source: "default" | "gallery",
): WorkspaceTemplateRecord {
  const timestamp = new Date().toISOString();

  return {
    id: preset.id,
    name: localizeWorkspaceText(preset.title, locale),
    description: localizeWorkspaceText(preset.description, locale),
    shortcutIds: preset.shortcutIds,
    customShortcuts: [],
    source,
    syncStatus: source === "gallery" ? "local" : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getDefaultWorkspaceTemplate(locale: WorkspaceLocale) {
  return createRecordFromPreset(DEFAULT_WORKSPACE_TEMPLATE, locale, "default");
}

export function getGalleryWorkspaceTemplates(locale: WorkspaceLocale) {
  return WORKSPACE_TEMPLATE_PRESETS.slice(1).map((preset) =>
    createRecordFromPreset(preset, locale, "gallery"),
  );
}

export function getStoredWorkspaceTemplates() {
  return readStorageTemplates().sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function listWorkspaceTemplates(locale: WorkspaceLocale) {
  return [getDefaultWorkspaceTemplate(locale), ...getStoredWorkspaceTemplates()];
}

export function getWorkspaceTemplateById(id: string, locale: WorkspaceLocale) {
  if (id === DEFAULT_WORKSPACE_TEMPLATE.id) {
    return getDefaultWorkspaceTemplate(locale);
  }

  return getStoredWorkspaceTemplates().find((item) => item.id === id) ?? null;
}

export function getSelectedWorkspaceTemplateId(locale: WorkspaceLocale) {
  if (!canUseStorage()) {
    return getDefaultWorkspaceTemplate(locale).id;
  }

  const selection = getSelectedWorkspaceTemplateSelection(locale);

  return selection.kind === "local"
    ? selection.templateId
    : getDefaultWorkspaceTemplate(locale).id;
}

export function setSelectedWorkspaceTemplateId(id: string) {
  setSelectedWorkspaceTemplateSelection({
    kind: "local",
    templateId: id,
  });
}

export function getSelectedWorkspaceTemplateSelection(
  locale: WorkspaceLocale,
): WorkspaceTemplateSelection {
  if (!canUseStorage()) {
    return {
      kind: "local",
      templateId: getDefaultWorkspaceTemplate(locale).id,
    };
  }

  const rawSelection = window.localStorage.getItem(SELECTED_TEMPLATE_TARGET_KEY);

  if (rawSelection) {
    try {
      const parsed = JSON.parse(rawSelection) as unknown;

      if (isTemplateSelection(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to the legacy local-only key.
    }
  }

  const rawValue = window.localStorage.getItem(SELECTED_TEMPLATE_KEY);
  return {
    kind: "local",
    templateId: rawValue && rawValue.length > 0 ? rawValue : getDefaultWorkspaceTemplate(locale).id,
  };
}

export function setSelectedWorkspaceTemplateSelection(
  selection: WorkspaceTemplateSelection,
) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    SELECTED_TEMPLATE_TARGET_KEY,
    JSON.stringify(selection),
  );

  if (selection.kind === "local") {
    window.localStorage.setItem(SELECTED_TEMPLATE_KEY, selection.templateId);
    return;
  }

  window.localStorage.removeItem(SELECTED_TEMPLATE_KEY);
}

export function clearSelectedWorkspaceTemplateSelection() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SELECTED_TEMPLATE_TARGET_KEY);
  window.localStorage.removeItem(SELECTED_TEMPLATE_KEY);
}

export function saveWorkspaceTemplate(template: WorkspaceTemplateRecord) {
  const existing = getStoredWorkspaceTemplates();
  const nextTemplates = existing.filter((item) => item.id !== template.id);
  nextTemplates.unshift(template);
  writeStorageTemplates(nextTemplates);
  return template;
}

export function createWorkspaceTemplate(
  locale: WorkspaceLocale,
  mode: "empty" | "default" = "empty",
): WorkspaceTemplateRecord {
  const timestamp = new Date().toISOString();

  return {
    id: `template-${Date.now()}`,
    name: locale === "ko" ? "새 템플릿" : "New template",
    description:
      mode === "default"
        ? locale === "ko"
          ? "LinKU 기본 바로가기를 바탕으로 시작"
          : "Starts from the LinKU default shortcut set"
        : locale === "ko"
          ? "직접 바로가기를 골라 만든 구성"
          : "A custom shortcut setup built on the web",
    shortcutIds:
      mode === "default" ? DEFAULT_WORKSPACE_TEMPLATE.shortcutIds.slice(0, 10) : [],
    customShortcuts: [],
    source: "custom",
    syncStatus: "local",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function cloneWorkspaceTemplate(
  template: WorkspaceTemplateRecord,
  locale: WorkspaceLocale,
) {
  const timestamp = new Date().toISOString();
  const clonedTemplate: WorkspaceTemplateRecord = {
    ...template,
    id: `template-${Date.now()}`,
    name:
      locale === "ko"
        ? `${template.name} 사본`
        : `${template.name} copy`,
    source: "custom",
    serverTemplateId: undefined,
    syncStatus: "local",
    postedTemplateId: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  saveWorkspaceTemplate(clonedTemplate);
  return clonedTemplate;
}

export function deleteWorkspaceTemplate(id: string) {
  const nextTemplates = getStoredWorkspaceTemplates().filter((item) => item.id !== id);
  writeStorageTemplates(nextTemplates);

  if (!canUseStorage()) {
    return;
  }

  if (window.localStorage.getItem(SELECTED_TEMPLATE_KEY) === id) {
    window.localStorage.removeItem(SELECTED_TEMPLATE_KEY);
  }

  try {
    const rawSelection = window.localStorage.getItem(SELECTED_TEMPLATE_TARGET_KEY);
    if (!rawSelection) {
      return;
    }

    const parsed = JSON.parse(rawSelection) as unknown;
    if (isTemplateSelection(parsed) && parsed.kind === "local" && parsed.templateId === id) {
      clearSelectedWorkspaceTemplateSelection();
    }
  } catch {
    clearSelectedWorkspaceTemplateSelection();
  }
}

export function cloneGalleryPresetToTemplate(
  presetId: string,
  locale: WorkspaceLocale,
) {
  const preset = getGalleryWorkspaceTemplates(locale).find((item) => item.id === presetId);
  if (!preset) {
    return null;
  }

  return cloneWorkspaceTemplate(preset, locale);
}
