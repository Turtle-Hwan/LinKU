import { DRAFT_SLOT_KEY, getLinkuDb } from "@/storage/linkuDb";
import { parseLegacyTemplateRecord } from "@/storage/legacyTemplateRecord";
import { debugLog, errorLog, warnLog } from "@/utils/logger";

const TEMPLATE_PREFIX = "linku_template_";
const TEMPLATE_INDEX_KEY = "linku_templates_index";
const DRAFT_KEY = "linku_template_draft";
const MIGRATION_KEY = "local-storage-templates-v1";

export async function migrateLegacyTemplates(): Promise<void> {
  const database = await getLinkuDb();
  if (await database.get("migrations", MIGRATION_KEY)) return;
  if (typeof localStorage === "undefined") return;

  const transaction = database.transaction(
    ["templates", "drafts", "migrations", "quarantine"],
    "readwrite",
  );

  try {
    // Another extension context may have completed the migration while this
    // transaction was waiting for its write lock.
    if (await transaction.objectStore("migrations").get(MIGRATION_KEY)) {
      await transaction.done;
      return;
    }

    const quarantineLegacyRecord = async (
      key: string,
      raw: string,
      reason: string,
    ): Promise<void> => {
      await transaction.objectStore("quarantine").put({
        id: crypto.randomUUID(),
        at: { store: "legacy-local-storage", key },
        reason,
        quarantinedAt: Date.now(),
        raw,
      });
    };

    const keys = new Set<string>();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(TEMPLATE_PREFIX) && key !== DRAFT_KEY) keys.add(key);
    }

    const legacyIndex = localStorage.getItem(TEMPLATE_INDEX_KEY);
    if (legacyIndex) {
      try {
        const entries = JSON.parse(legacyIndex) as Array<{ templateId?: number }>;
        for (const entry of entries) {
          if (typeof entry.templateId === "number" && entry.templateId !== 0) {
            keys.add(`${TEMPLATE_PREFIX}${entry.templateId}`);
          }
        }
      } catch (error) {
        errorLog("Failed to read legacy template index", error);
      }
    }

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const result = parseLegacyTemplateRecord(raw);
      if (!result.ok) {
        await quarantineLegacyRecord(key, raw, result.reason);
        warnLog("Quarantined unreadable legacy template", {
          key,
          reason: result.reason,
        });
        continue;
      }

      if (result.repairs.length > 0) {
        debugLog(`Repaired legacy template ${key}`, result.repairs);
      }

      const { stored } = result;
      const templateStore = transaction.objectStore("templates");
      if (await templateStore.get(stored.template.templateId)) {
        await quarantineLegacyRecord(
          key,
          raw,
          "같은 식별자의 템플릿이 이미 있어 원본을 별도로 보관했습니다.",
        );
        warnLog("Quarantined duplicate legacy template id", {
          key,
          templateId: stored.template.templateId,
        });
        continue;
      }

      await templateStore.put(stored, stored.template.templateId);
    }

    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const result = parseLegacyTemplateRecord(draft, {
        allowUnsavedTemplateId: true,
      });
      if (result.ok) {
        await transaction.objectStore("drafts").put(result.stored, DRAFT_SLOT_KEY);
      } else {
        await quarantineLegacyRecord(DRAFT_KEY, draft, result.reason);
        warnLog("Quarantined unreadable legacy template draft", {
          reason: result.reason,
        });
      }
    }

    await transaction
      .objectStore("migrations")
      .put({ completedAt: Date.now() }, MIGRATION_KEY);
    await transaction.done;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already be aborted by IndexedDB.
    }
    throw error;
  }
}

/** Removes the rollback source before deleting its active IndexedDB copy. */
export function removeLegacyTemplateSource(templateId: number): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(`${TEMPLATE_PREFIX}${templateId}`);
  } catch (error) {
    throw Object.assign(
      new Error("템플릿의 이전 저장 사본을 삭제하지 못했습니다."),
      { cause: error },
    );
  }

  try {
    const legacyIndex = localStorage.getItem(TEMPLATE_INDEX_KEY);
    if (!legacyIndex) return;

    const entries = JSON.parse(legacyIndex) as Array<{ templateId?: number }>;
    localStorage.setItem(
      TEMPLATE_INDEX_KEY,
      JSON.stringify(
        entries.filter((entry) => entry.templateId !== templateId),
      ),
    );
  } catch (error) {
    // A stale index entry is harmless once the corresponding record is gone.
    warnLog("Failed to clean deleted template from legacy index", error);
  }
}
