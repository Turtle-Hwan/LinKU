import { UNSAVED_TEMPLATE_ID } from "../constants/template.ts";
import type { StoredTemplate } from "./linkuDb.ts";
import { normalizeStoredTemplate } from "./templateRecord.ts";

export type LegacyTemplateRecordResult =
  | { ok: true; stored: StoredTemplate; repairs: string[] }
  | { ok: false; reason: string };

/**
 * Parses one exact localStorage value without throwing. The caller owns where
 * an invalid value is quarantined; keeping this decision pure makes every
 * migration path use the same acceptance rules.
 */
export function parseLegacyTemplateRecord(
  raw: string,
  options: { allowUnsavedTemplateId?: boolean } = {},
): LegacyTemplateRecordResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "레거시 템플릿 JSON을 읽을 수 없습니다." };
  }

  const normalized = normalizeStoredTemplate(parsed);
  if (!normalized.value) {
    return {
      ok: false,
      reason: normalized.reason ?? "레거시 템플릿을 읽을 수 없습니다.",
    };
  }

  if (
    !options.allowUnsavedTemplateId &&
    normalized.value.template.templateId === UNSAVED_TEMPLATE_ID
  ) {
    return {
      ok: false,
      reason: "저장된 템플릿 식별자가 올바르지 않습니다.",
    };
  }

  return {
    ok: true,
    stored: normalized.value,
    repairs: normalized.repairs,
  };
}
