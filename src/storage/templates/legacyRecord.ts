import type { StoredTemplate } from "../indexedDb/linkuDatabase.ts";
import { normalizeStoredTemplate } from "./record.ts";

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

  const normalized = normalizeStoredTemplate(parsed, options);
  if (!normalized.value) {
    return {
      ok: false,
      reason: normalized.reason ?? "레거시 템플릿을 읽을 수 없습니다.",
    };
  }

  return {
    ok: true,
    stored: normalized.value,
    repairs: normalized.repairs,
  };
}
