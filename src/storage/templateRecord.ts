/**
 * Read-time normalization for stored templates.
 *
 * IndexedDB is the only copy of a personal template, and a broken record
 * cannot be repaired from a server or inspected remotely. Every record is
 * therefore normalized on the way out of the database as well as during the
 * legacy migration, with a deliberate split:
 *
 * - repairable damage (out-of-grid geometry, missing timestamps, duplicate
 *   item ids) is corrected in place and reported as a repair note;
 * - unusable damage (no template object, no item list, unusable id) yields a
 *   null value so the caller can quarantine the original bytes instead of
 *   handing broken data to the editor.
 *
 * Nothing here deletes user data, and no rule may reject data that older
 * LinKU versions legitimately wrote.
 */

import type { Template, TemplateIcon, TemplateItem } from "../types/api.ts";
import type { StoredTemplate } from "./linkuDb.ts";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  MAX_SITE_URL_LENGTH,
  MAX_TEMPLATE_ITEMS,
  MAX_TEMPLATE_NAME_LENGTH,
} from "../constants/template.ts";

export interface NormalizeResult {
  /** Normalized record, or null when the record must be quarantined. */
  value: StoredTemplate | null;
  /** Why the record is unusable. Present only when `value` is null. */
  reason?: string;
  /** Human-readable notes describing every correction that was applied. */
  repairs: string[];
}

export interface NormalizeOptions {
  /** Only the preserved legacy draft may use the unsaved template id. */
  allowUnsavedTemplateId?: boolean;
  /** Active IndexedDB records must agree with the key that addressed them. */
  expectedTemplateId?: number;
}

const IMPORTED_TEMPLATE_SUFFIX = " (가져옴)";

export function normalizeTemplateName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || "이름 없는 템플릿").slice(0, MAX_TEMPLATE_NAME_LENGTH);
}

export function formatImportedTemplateName(name: string): string {
  const normalizedName = normalizeTemplateName(name);
  const baseName = normalizedName.endsWith(IMPORTED_TEMPLATE_SUFFIX)
    ? normalizedName.slice(0, -IMPORTED_TEMPLATE_SUFFIX.length)
    : normalizedName;
  return `${baseName.slice(
    0,
    MAX_TEMPLATE_NAME_LENGTH - IMPORTED_TEMPLATE_SUFFIX.length,
  )}${IMPORTED_TEMPLATE_SUFFIX}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toInteger(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(Number(value)) : fallback;
}

const URL_SCHEME_PATTERN = /^([a-z][a-z\d+.-]*):/iu;

function normalizeHttpUrl(value: string): string | null {
  if (value.length > MAX_SITE_URL_LENGTH) return null;
  try {
    const scheme = URL_SCHEME_PATTERN.exec(value)?.[1]?.toLowerCase();
    if (scheme && scheme !== "https" && scheme !== "http") return null;
    const candidate = scheme
      ? value
      : value.startsWith("//")
        ? `https:${value}`
        : `https://${value}`;
    const url = new URL(candidate);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.hostname.length === 0 ||
      /[%\s]/u.test(url.hostname)
    ) {
      return null;
    }
    return url.href.length <= MAX_SITE_URL_LENGTH ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeIcon(value: unknown, itemName: string): TemplateIcon {
  const icon = isRecord(value) ? value : {};
  return {
    // Icon ids are not re-derived here. A non-positive id means the icon was
    // never registered in the asset store; the storage layer re-registers it
    // when the URL carries the image, and reports it when it cannot.
    iconId: toInteger(icon.iconId, 0),
    iconName:
      typeof icon.iconName === "string" && icon.iconName.length > 0
        ? icon.iconName.slice(0, MAX_TEMPLATE_NAME_LENGTH)
        : itemName,
    iconUrl: typeof icon.iconUrl === "string" ? icon.iconUrl : "",
  };
}

function normalizeItems(
  value: unknown,
  templateHeight: number,
  repairs: string[],
  label: string,
  usedIds: Set<number>,
): TemplateItem[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) repairs.push(`${label} 목록이 없어 비웠습니다.`);
    return [];
  }

  const items: TemplateItem[] = [];

  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      repairs.push(`${label} ${index + 1}번째 항목을 읽을 수 없어 제외했습니다.`);
      return;
    }

    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const siteUrl =
      typeof candidate.siteUrl === "string" ? candidate.siteUrl.trim() : "";
    const normalizedSiteUrl = normalizeHttpUrl(siteUrl);
    if (name.length === 0 || !normalizedSiteUrl) {
      repairs.push(
        `${label} ${index + 1}번째 항목의 이름이나 주소가 올바르지 않아 제외했습니다.`,
      );
      return;
    }
    if (normalizedSiteUrl !== siteUrl) {
      repairs.push(`${label} “${name}” 항목의 주소를 표준 형식으로 보정했습니다.`);
    }

    const position = isRecord(candidate.position) ? candidate.position : {};
    const size = isRecord(candidate.size) ? candidate.size : {};

    const width = clamp(toInteger(size.width, 1), 1, GRID_COLUMNS);
    const height = clamp(toInteger(size.height, 1), 1, templateHeight);
    const x = clamp(toInteger(position.x, 0), 0, GRID_COLUMNS - width);
    const y = clamp(toInteger(position.y, 0), 0, templateHeight - height);

    if (
      width !== toInteger(size.width, 1) ||
      height !== toInteger(size.height, 1) ||
      x !== toInteger(position.x, 0) ||
      y !== toInteger(position.y, 0)
    ) {
      repairs.push(
        `${label} “${name}” 항목이 템플릿 영역을 벗어나 위치를 보정했습니다.`,
      );
    }

    let templateItemId = toInteger(candidate.templateItemId, 0);
    if (templateItemId === 0 || usedIds.has(templateItemId)) {
      templateItemId = index + 1;
      while (usedIds.has(templateItemId)) templateItemId += 1;
      repairs.push(`${label} “${name}” 항목의 식별자를 새로 부여했습니다.`);
    }
    usedIds.add(templateItemId);

    items.push({
      templateItemId,
      name: name.slice(0, MAX_TEMPLATE_NAME_LENGTH),
      siteUrl: normalizedSiteUrl,
      position: { x, y },
      size: { width, height },
      icon: normalizeIcon(candidate.icon, name),
    });
  });

  if (items.length > MAX_TEMPLATE_ITEMS) {
    repairs.push(
      `${label} 항목이 ${MAX_TEMPLATE_ITEMS}개를 넘어 초과분을 제외했습니다.`,
    );
    return items.slice(0, MAX_TEMPLATE_ITEMS);
  }
  return items;
}

export function normalizeStoredTemplate(
  raw: unknown,
  options: NormalizeOptions = {},
): NormalizeResult {
  const repairs: string[] = [];

  if (!isRecord(raw) || !isRecord(raw.template)) {
    return { value: null, reason: "템플릿 데이터를 읽을 수 없습니다.", repairs };
  }

  const source = raw.template;
  const templateId = source.templateId;
  if (
    !Number.isSafeInteger(templateId) ||
    Number(templateId) < 0 ||
    (Number(templateId) === 0 && !options.allowUnsavedTemplateId) ||
    (options.expectedTemplateId !== undefined &&
      Number(templateId) !== options.expectedTemplateId)
  ) {
    return {
      value: null,
      reason: "템플릿 식별자가 올바르지 않습니다.",
      repairs,
    };
  }

  if (!Array.isArray(source.items)) {
    return { value: null, reason: "템플릿 항목 목록이 없습니다.", repairs };
  }

  const sourceName = typeof source.name === "string" ? source.name.trim() : "";
  const name = normalizeTemplateName(sourceName);
  if (sourceName.length === 0) {
    repairs.push("템플릿 이름이 비어 있어 기본 이름을 넣었습니다.");
  }
  if (sourceName.length > MAX_TEMPLATE_NAME_LENGTH) {
    repairs.push("템플릿 이름이 너무 길어 잘랐습니다.");
  }

  const rawHeight = toInteger(source.height, GRID_ROWS);
  const height = clamp(rawHeight, 1, GRID_ROWS);
  if (height !== rawHeight) {
    repairs.push("템플릿 높이가 허용 범위를 벗어나 보정했습니다.");
  }

  const now = new Date().toISOString();
  const sourceId =
    typeof source.id === "string" && source.id.trim().length > 0
      ? source.id.trim()
      : null;
  if (!sourceId) {
    repairs.push("템플릿 고유 식별자가 없어 새로 부여했습니다.");
  } else if (sourceId !== source.id) {
    repairs.push("템플릿 고유 식별자의 공백을 정리했습니다.");
  }

  const sourceCreatedAt =
    typeof source.createdAt === "string" && source.createdAt.length > 0
      ? source.createdAt
      : null;
  const sourceUpdatedAt =
    typeof source.updatedAt === "string" && source.updatedAt.length > 0
      ? source.updatedAt
      : null;
  const createdAt = sourceCreatedAt ?? sourceUpdatedAt ?? now;
  const updatedAt = sourceUpdatedAt ?? createdAt;
  if (!sourceCreatedAt) {
    repairs.push("템플릿 생성 시각이 없어 복구했습니다.");
  }
  if (!sourceUpdatedAt) {
    repairs.push("템플릿 수정 시각이 없어 복구했습니다.");
  }

  const usedItemIds = new Set<number>();
  const template: Template = {
    templateId: Number(templateId),
    id: sourceId ?? crypto.randomUUID(),
    name,
    height,
    cloned: Boolean(source.cloned),
    createdAt,
    updatedAt,
    syncStatus: "local",
    items: normalizeItems(
      source.items,
      height,
      repairs,
      "템플릿",
      usedItemIds,
    ),
  };

  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  let lastSaved = Date.now();
  if (typeof metadata.lastSaved === "number" && Number.isFinite(metadata.lastSaved)) {
    lastSaved = metadata.lastSaved;
  } else {
    // Recorded as a repair so the substitute is written back once. Left
    // silent, the timestamp would be re-invented on every read and the
    // template list would reorder itself each time it opens.
    repairs.push("마지막 저장 시각이 없어 현재 시각으로 채웠습니다.");
  }

  return {
    value: {
      template,
      stagingItems: normalizeItems(
        raw.stagingItems,
        height,
        repairs,
        "임시",
        usedItemIds,
      ),
      metadata: { lastSaved, savedLocally: true },
    },
    repairs,
  };
}
