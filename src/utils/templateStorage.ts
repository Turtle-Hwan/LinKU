/**
 * IndexedDB-backed template persistence.
 *
 * Existing function names remain stable while legacy localStorage data is
 * imported once. Legacy values are retained as a rollback source.
 */

import {
  getLinkuDb,
  type StoredTemplate,
  type TemplateSyncState,
} from "@/storage/linkuDb";
import type { Template, TemplateItem } from "@/types/api";
import { errorLog } from "@/utils/logger";

export type { StoredTemplate, TemplateSyncState } from "@/storage/linkuDb";

export interface TemplateIndexEntry {
  templateId: number;
  syncId: string;
  name: string;
  lastSaved: number;
  syncedWithServer: boolean;
  syncState: TemplateSyncState;
}

const STORAGE_PREFIX = "linku_template_";
const INDEX_KEY = "linku_templates_index";
const DRAFT_KEY = "linku_template_draft";
const MIGRATION_KEY = "local-storage-templates-v1";

let migrationPromise: Promise<void> | undefined;

function normalizeStoredTemplate(value: StoredTemplate): StoredTemplate {
  const syncedWithServer = Boolean(value.metadata?.syncedWithServer);
  return {
    ...value,
    template: {
      ...value.template,
      id: value.template.id || crypto.randomUUID(),
      syncStatus: syncedWithServer ? "synced" : "local",
    },
    stagingItems: Array.isArray(value.stagingItems) ? value.stagingItems : [],
    metadata: {
      lastSaved: value.metadata?.lastSaved ?? Date.now(),
      savedLocally: true,
      syncedWithServer,
      syncState: syncedWithServer ? "synced" : "local",
      serverSyncedAt: value.metadata?.serverSyncedAt,
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
        const stored = normalizeStoredTemplate(JSON.parse(raw) as StoredTemplate);
        if (stored.template.templateId !== 0) {
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
        await transaction
          .objectStore("drafts")
          .put(normalizeStoredTemplate(JSON.parse(draft) as StoredTemplate), "current");
      } catch (error) {
        errorLog("Failed to migrate legacy template draft", error);
      }
    }

    await transaction
      .objectStore("migrations")
      .put({ completedAt: Date.now() }, MIGRATION_KEY);
    await transaction.done;
  } catch (error) {
    transaction.abort();
    errorLog("Failed to migrate template localStorage to IndexedDB", error);
    throw error;
  }
}

async function ensureMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyLocalStorage().catch((error) => {
      migrationPromise = undefined;
      throw error;
    });
  }
  await migrationPromise;
}

export async function saveTemplateToLocalStorage(
  template: Template,
  stagingItems: TemplateItem[] = [],
  syncedWithServer = false,
): Promise<void> {
  await ensureMigration();
  const database = await getLinkuDb();
  const now = Date.now();
  const stored: StoredTemplate = {
    template: {
      ...template,
      id: template.id || crypto.randomUUID(),
      syncStatus: syncedWithServer ? "synced" : "local",
    },
    stagingItems,
    metadata: {
      lastSaved: now,
      savedLocally: true,
      syncedWithServer,
      syncState: syncedWithServer ? "synced" : "local",
      serverSyncedAt: syncedWithServer ? now : undefined,
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
      syncId: stored.template.id,
      name: stored.template.name,
      lastSaved: stored.metadata.lastSaved,
      syncedWithServer: stored.metadata.syncedWithServer,
      syncState: stored.metadata.syncState,
    }))
    .sort((left, right) => right.lastSaved - left.lastSaved);
}

export async function deleteTemplateFromLocalStorage(
  templateId: number,
): Promise<void> {
  await ensureMigration();
  const database = await getLinkuDb();
  await database.delete("templates", templateId);
}

export function checkLocalStorageSpace(): {
  available: boolean;
  error?: string;
} {
  return typeof indexedDB !== "undefined"
    ? { available: true }
    : { available: false, error: "IndexedDB를 사용할 수 없습니다." };
}

export async function updateTemplateSyncStatus(
  templateId: number,
  syncedWithServer: boolean,
  syncState: TemplateSyncState = syncedWithServer ? "synced" : "local",
): Promise<void> {
  await ensureMigration();
  const database = await getLinkuDb();
  const stored = await database.get("templates", templateId);
  if (!stored) return;

  stored.template.syncStatus = syncedWithServer ? "synced" : "local";
  stored.metadata.syncedWithServer = syncedWithServer;
  stored.metadata.syncState = syncState;
  stored.metadata.serverSyncedAt = syncedWithServer ? Date.now() : undefined;
  await database.put("templates", stored, templateId);
}

export async function findTemplateBySyncId(
  syncId: string,
): Promise<StoredTemplate | null> {
  await ensureMigration();
  const database = await getLinkuDb();
  const templates = await database.getAll("templates");
  return templates.find((stored) => stored.template.id === syncId) ?? null;
}

export async function importSharedTemplate(
  template: Template,
  stagingItems: TemplateItem[] = [],
): Promise<StoredTemplate> {
  await ensureMigration();
  const database = await getLinkuDb();
  let templateId = Date.now();
  while (await database.get("templates", templateId)) templateId += 1;

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
  await saveTemplateToLocalStorage(imported, stagingItems, false);
  const stored = await loadTemplateFromLocalStorage(imported.templateId);
  if (!stored) throw new Error("가져온 템플릿을 저장하지 못했습니다.");
  return stored;
}
