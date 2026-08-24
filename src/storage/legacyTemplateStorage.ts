import { getLinkuDb } from "@/storage/linkuDb";
import {
  LEGACY_DRAFT_KEY,
  LEGACY_TEMPLATE_INDEX_KEY,
  LEGACY_TEMPLATE_PREFIX,
  migrateLegacyTemplateStorage,
} from "@/storage/legacyTemplateMigration";
import {
  debugLog,
  captureErrorLog,
  captureWarnLog,
  warnLog,
} from "@/utils/logger";

export async function migrateLegacyTemplates(): Promise<void> {
  if (typeof localStorage === "undefined") return;

  const report = await migrateLegacyTemplateStorage(
    await getLinkuDb(),
    localStorage,
  );
  if (report.indexError !== undefined) {
    captureErrorLog("Failed to read legacy template index", report.indexError);
  }
  for (const repaired of report.repaired) {
    debugLog(`Repaired legacy template ${repaired.key}`, repaired.repairs);
  }
  for (const quarantined of report.quarantined) {
    if (quarantined.kind === "conflict") {
      // The active IndexedDB record won and the duplicate rollback copy was
      // preserved in quarantine, so this is a successful recovery outcome.
      warnLog("Quarantined conflicting legacy template", {
        key: quarantined.key,
        templateId: quarantined.templateId,
      });
    } else if (quarantined.key === LEGACY_DRAFT_KEY) {
      captureWarnLog("Quarantined unreadable legacy template draft", {
        reason: quarantined.reason,
      });
    } else {
      captureWarnLog("Quarantined unreadable legacy template", {
        key: quarantined.key,
        reason: quarantined.reason,
      });
    }
  }
}

/** Removes the rollback source before deleting its active IndexedDB copy. */
export function removeLegacyTemplateSource(templateId: number): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(`${LEGACY_TEMPLATE_PREFIX}${templateId}`);
  } catch (error) {
    throw Object.assign(
      new Error("템플릿의 이전 저장 사본을 삭제하지 못했습니다."),
      { cause: error },
    );
  }

  try {
    const legacyIndex = localStorage.getItem(LEGACY_TEMPLATE_INDEX_KEY);
    if (!legacyIndex) return;

    const entries = JSON.parse(legacyIndex) as Array<{ templateId?: number }>;
    localStorage.setItem(
      LEGACY_TEMPLATE_INDEX_KEY,
      JSON.stringify(
        entries.filter((entry) => entry.templateId !== templateId),
      ),
    );
  } catch (error) {
    // A stale index entry is harmless once the corresponding record is gone.
    warnLog("Failed to clean deleted template from legacy index", error);
  }
}
