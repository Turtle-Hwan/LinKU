/**
 * IndexedDB-backed template persistence.
 *
 * Existing function names remain stable while legacy localStorage data is
 * imported once. Legacy values are retained as a rollback source.
 */

import { getLinkuDb, type StoredTemplate } from "@/storage/linkuDb";
import type { Template, TemplateItem } from "@/types/api";
import { errorLog } from "@/utils/logger";

export type { StoredTemplate } from "@/storage/linkuDb";

export interface TemplateIndexEntry {
  templateId: number;
  name: string;
  lastSaved: number;
}

const STORAGE_PREFIX = "linku_template_";
const INDEX_KEY = "linku_templates_index";
const DRAFT_KEY = "linku_template_draft";
const MIGRATION_KEY = "local-storage-templates-v1";

let migrationPromise: Promise<void> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStoredTemplate(value: unknown): StoredTemplate | null {
  if (!isRecord(value) || !isRecord(value.template)) return null;
  const templateValue = value.template;
  if (
    !Number.isSafeInteger(templateValue.templateId) ||
    Number(templateValue.templateId) < 0 ||
    typeof templateValue.name !== "string" ||
    !Number.isInteger(templateValue.height) ||
    Number(templateValue.height) < 1 ||
    Number(templateValue.height) > 6 ||
    !Array.isArray(templateValue.items)
  ) {
    return null;
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const now = new Date().toISOString();
  const template = templateValue as unknown as Template;
  return {
    template: {
      ...template,
      id:
        typeof templateValue.id === "string" && templateValue.id.length > 0
          ? templateValue.id
          : crypto.randomUUID(),
      cloned: Boolean(templateValue.cloned),
      createdAt:
        typeof templateValue.createdAt === "string"
          ? templateValue.createdAt
          : now,
      updatedAt:
        typeof templateValue.updatedAt === "string"
          ? templateValue.updatedAt
          : now,
      syncStatus: "local",
    },
    stagingItems: Array.isArray(value.stagingItems)
      ? (value.stagingItems as TemplateItem[])
      : [],
    metadata: {
      lastSaved:
        typeof metadata.lastSaved === "number"
          ? metadata.lastSaved
          : Date.now(),
      savedLocally: true,
    },
  };
}

async function migrateLegacyLocalStorage(): Promise<void> {
  const database = await getLinkuDb();
  if (await database.get("migrations", MIGRATION_KEY)) return;

  if (typeof localStorage === "undefined") return;

  const transaction = database.transaction(
    ["templates", "drafts", "migrations"],
    "readwrite",
  );

  try {
    const keys = new Set<string>();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.add(key);
    }

    const legacyIndex = localStorage.getItem(INDEX_KEY);
    if (legacyIndex) {
      try {
        const entries = JSON.parse(legacyIndex) as Array<{ templateId?: number }>;
        for (const entry of entries) {
          if (typeof entry.templateId === "number" && entry.templateId !== 0) {
            keys.add(`${STORAGE_PREFIX}${entry.templateId}`);
          }
        }
      } catch (error) {
        errorLog("Failed to read legacy template index", error);
      }
    }

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const stored = normalizeStoredTemplate(JSON.parse(raw) as unknown);
        if (stored && stored.template.templateId !== 0) {
          await transaction
            .objectStore("templates")
            .put(stored, stored.template.templateId);
        }
      } catch (error) {
        errorLog(`Failed to migrate legacy template ${key}`, error);
      }
    }

    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const storedDraft = normalizeStoredTemplate(JSON.parse(draft) as unknown);
        if (storedDraft) {
          await transaction.objectStore("drafts").put(storedDraft, "current");
        }
      } catch (error) {
        errorLog("Failed to migrate legacy template draft", error);
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
    errorLog("Failed to migrate template localStorage to IndexedDB", error);
    throw error;
  }
}

async function ensureMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyLocalStorage().catch((error) => {
      errorLog(
        "Legacy template migration failed; continuing with IndexedDB",
        error,
      );
    });
  }
  await migrationPromise;
}

export async function saveTemplateToLocalStorage(
  template: Template,
  stagingItems: TemplateItem[] = [],
): Promise<void> {
  await ensureMigration();
  const database = await getLinkuDb();
  const now = Date.now();
  const stored: StoredTemplate = {
    template: {
      ...template,
      id: template.id || crypto.randomUUID(),
      syncStatus: "local",
    },
    stagingItems,
    metadata: {
      lastSaved: now,
      savedLocally: true,
    },
  };

  try {
    if (template.templateId === 0) {
      await database.put("drafts", stored, "current");
    } else {
      await database.put("templates", stored, template.templateId);
    }
  } catch (error) {
    errorLog("Failed to save template to IndexedDB", error);
    throw Object.assign(new Error("브라우저 저장소에 저장하지 못했습니다."), {
      cause: error,
    });
  }
}

export async function loadTemplateFromLocalStorage(
  templateId: number,
): Promise<StoredTemplate | null> {
  await ensureMigration();
  const database = await getLinkuDb();
  const value =
    templateId === 0
      ? await database.get("drafts", "current")
      : await database.get("templates", templateId);
  return value ?? null;
}

export async function getTemplatesIndex(): Promise<TemplateIndexEntry[]> {
  await ensureMigration();
  const database = await getLinkuDb();
  const templates = await database.getAll("templates");
  return templates
    .map((stored) => ({
      templateId: stored.template.templateId,
      name: stored.template.name,
      lastSaved: stored.metadata.lastSaved,
    }))
    .sort((left, right) => right.lastSaved - left.lastSaved);
}

export async function deleteTemplateFromLocalStorage(
  templateId: number,
): Promise<void> {
  await ensureMigration();
  const database = await getLinkuDb();
  await database.delete("templates", templateId);

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${templateId}`);
      const legacyIndex = localStorage.getItem(INDEX_KEY);
      if (legacyIndex) {
        const entries = JSON.parse(legacyIndex) as Array<{ templateId?: number }>;
        localStorage.setItem(
          INDEX_KEY,
          JSON.stringify(
            entries.filter((entry) => entry.templateId !== templateId),
          ),
        );
      }
    } catch (error) {
      errorLog("Failed to remove deleted template from legacy storage", error);
    }
  }
}

export function checkTemplateStorageAvailability(): {
  available: boolean;
  error?: string;
} {
  return typeof indexedDB !== "undefined"
    ? { available: true }
    : { available: false, error: "IndexedDB를 사용할 수 없습니다." };
}

export async function importSharedTemplate(
  template: Template,
  stagingItems: TemplateItem[] = [],
): Promise<StoredTemplate> {
  await ensureMigration();
  const database = await getLinkuDb();
  const transaction = database.transaction("templates", "readwrite");
  const store = transaction.objectStore("templates");
  let templateId = Date.now();
  while (await store.get(templateId)) templateId += 1;

  const now = new Date().toISOString();
  const imported: Template = {
    ...template,
    id: crypto.randomUUID(),
    templateId,
    name: template.name.endsWith("(가져옴)")
      ? template.name
      : `${template.name} (가져옴)`,
    cloned: true,
    syncStatus: "local",
    createdAt: now,
    updatedAt: now,
  };
  const stored: StoredTemplate = {
    template: imported,
    stagingItems,
    metadata: {
      lastSaved: Date.now(),
      savedLocally: true,
    },
  };
  await store.put(stored, templateId);
  await transaction.done;
  return stored;
}
