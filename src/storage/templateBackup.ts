/**
 * Pure validation and preparation rules for whole-store template backups.
 *
 * Kept outside the IndexedDB repository so an untrusted JSON file can be
 * checked before any browser storage or image decoding work starts.
 */

import {
  MAX_TEMPLATE_NAME_LENGTH,
  PORTABLE_ICON_PATTERN,
  UNSAVED_TEMPLATE_ID,
} from "../constants/template.ts";
import type { TemplateItem } from "../types/api.ts";
import type { StoredTemplate } from "./linkuDb.ts";
import { normalizeStoredTemplate } from "./templateRecord.ts";

export const MAX_TEMPLATE_BACKUP_BYTES = 10 * 1024 * 1024;

const MAX_BACKUP_ENTRIES = 10_000;

export function assertTemplateBackupSize(value: unknown): void {
  let serialized: string | undefined;
  try {
    // `downloadJson` uses the same indentation, so this measures the exact
    // bytes that will be handed back to the user rather than a smaller compact
    // representation that could cross the limit only after formatting.
    serialized = JSON.stringify(value, null, 2);
  } catch {
    throw new Error("백업 데이터를 파일로 만들 수 없습니다.");
  }

  if (typeof serialized !== "string") {
    throw new Error("백업 데이터를 파일로 만들 수 없습니다.");
  }

  if (new TextEncoder().encode(serialized).byteLength > MAX_TEMPLATE_BACKUP_BYTES) {
    throw new Error(
      "전체 백업 데이터가 10MB를 초과합니다. 사용하지 않는 템플릿이나 사용자 아이콘을 정리한 뒤 다시 시도해 주세요.",
    );
  }
}

export interface TemplateBackupAssetV1 {
  name: string;
  dataUrl: string;
}

export interface TemplateBackupV1<TTemplate = unknown> {
  kind: "linku-backup";
  version: 1;
  exportedAt: string;
  templates: TTemplate[];
  assets: TemplateBackupAssetV1[];
}

export interface RestoredAssetReference {
  numericId: number;
  name: string;
  dataUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidExportedAt(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseBackupAsset(value: unknown, index: number): TemplateBackupAssetV1 {
  if (!isRecord(value)) {
    throw new Error(`${index + 1}번째 백업 아이콘이 올바르지 않습니다.`);
  }
  const { name, dataUrl } = value;
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (
    normalizedName.length === 0 ||
    normalizedName.length > MAX_TEMPLATE_NAME_LENGTH ||
    typeof dataUrl !== "string" ||
    dataUrl.length > MAX_TEMPLATE_BACKUP_BYTES ||
    !PORTABLE_ICON_PATTERN.test(dataUrl)
  ) {
    throw new Error(`${index + 1}번째 백업 아이콘이 올바르지 않습니다.`);
  }
  return { name: normalizedName, dataUrl };
}

/** Validates the envelope without rejecting recoverable template records. */
export function parseTemplateBackup(value: unknown): TemplateBackupV1 {
  if (!isRecord(value)) throw new Error("LinKU 백업 파일이 아닙니다.");
  assertTemplateBackupSize(value);

  const { kind, version, exportedAt, templates, assets } = value;
  if (
    kind !== "linku-backup" ||
    version !== 1 ||
    !isValidExportedAt(exportedAt) ||
    !Array.isArray(templates) ||
    !Array.isArray(assets) ||
    templates.length > MAX_BACKUP_ENTRIES ||
    assets.length > MAX_BACKUP_ENTRIES
  ) {
    throw new Error("LinKU 백업 파일이 아닙니다.");
  }

  return {
    kind,
    version,
    exportedAt,
    templates,
    assets: assets.map(parseBackupAsset),
  };
}

function remapItems(
  items: TemplateItem[],
  restoredAssets: ReadonlyMap<string, RestoredAssetReference>,
): TemplateItem[] {
  return items.map((item) => {
    const restored = restoredAssets.get(item.icon.iconUrl);
    if (!restored) return item;
    return {
      ...item,
      icon: {
        iconId: restored.numericId,
        iconName: restored.name,
        iconUrl: restored.dataUrl,
      },
    };
  });
}

/**
 * Turns one backup record into a new local resource.
 *
 * `templateId` and the stable UUID are both regenerated. The latter becomes
 * the remote object key in the optional account-sync layer; preserving it
 * would let a repeated or second-device restore overwrite the same object.
 */
export function prepareRestoredTemplate(
  record: unknown,
  restoredAssets: ReadonlyMap<string, RestoredAssetReference>,
): StoredTemplate | null {
  const normalized = normalizeStoredTemplate(record);
  if (!normalized.value) return null;

  const now = new Date().toISOString();
  return {
    ...normalized.value,
    template: {
      ...normalized.value.template,
      id: crypto.randomUUID(),
      templateId: UNSAVED_TEMPLATE_ID,
      createdAt: now,
      updatedAt: now,
      items: remapItems(normalized.value.template.items, restoredAssets),
    },
    stagingItems: remapItems(normalized.value.stagingItems, restoredAssets),
  };
}
