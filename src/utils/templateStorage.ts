/**
 * IndexedDB-backed template persistence.
 *
 * Existing function names remain stable while legacy localStorage data is
 * imported once. Legacy values are retained as a rollback source.
 *
 * This module owns three invariants that nothing else may reimplement,
 * because a device-local store has no server to reconcile against and no way
 * to inspect or repair a user's data after the fact:
 *
 * 1. template ids are allocated here, inside the same transaction as the
 *    write, so a save can never overwrite an existing template;
 * 2. every record is normalized on the way out, repaired when possible and
 *    quarantined (never deleted) when not;
 * 3. inline icons are registered as assets so imported items stay editable.
 */

import {
  getAssetByNumericId,
  saveAssetFromDataUrl,
} from "@/storage/assetRepository";
import {
  DRAFT_SLOT_KEY,
  getLinkuDb,
  type RecordLocation,
  type StoredTemplate,
} from "@/storage/linkuDb";
import {
  PORTABLE_ICON_PATTERN,
  UNSAVED_TEMPLATE_ID,
} from "@/constants/template";
import { quarantineSafely } from "@/storage/quarantine";
import { allocateMonotonicId } from "@/storage/monotonicId";
import { normalizeStoredTemplate } from "@/storage/templateRecord";
import type { Template, TemplateItem } from "@/types/api";
import { debugLog, errorLog } from "@/utils/logger";
import { portablePayloadToTemplate } from "@/utils/templateShare";
import { validateTemplateSharePayload } from "@/utils/templateShareCodec";
import type { TemplateSharePayloadV1 } from "@/types/templateShare";

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

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/**
 * Turns a storage failure into a message the user can act on. A generic
 * "저장 실패" hides the one cause the user can actually resolve.
 */
function toStorageError(error: unknown, fallbackMessage: string): Error {
  const message = isQuotaError(error)
    ? "브라우저 저장 공간이 가득 찼습니다. 템플릿이나 아이콘을 정리한 뒤 다시 시도해 주세요."
    : fallbackMessage;
  return Object.assign(new Error(message), { cause: error });
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
        const result = normalizeStoredTemplate(JSON.parse(raw) as unknown);
        if (result.repairs.length > 0) {
          debugLog(`Repaired legacy template ${key}`, result.repairs);
        }
        const stored = result.value;
        if (stored && stored.template.templateId !== UNSAVED_TEMPLATE_ID) {
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
        const result = normalizeStoredTemplate(JSON.parse(draft) as unknown);
        if (result.value) {
          await transaction.objectStore("drafts").put(result.value, "current");
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

/**
 * Re-registers inline icons that no asset backs.
 *
 * The editor resolves an icon by numeric id, and `linkFormSchema` rejects a
 * non-positive one, so an item whose icon was never registered cannot be
 * edited or saved again — a dead end the user cannot escape without losing
 * the icon. When the record still carries the image we restore it instead.
 */
async function repairUnregisteredIcons(
  stored: StoredTemplate,
): Promise<{ stored: StoredTemplate; changed: boolean }> {
  let changed = false;

  const repairItems = async (items: TemplateItem[]): Promise<TemplateItem[]> => {
    const repaired: TemplateItem[] = [];
    for (const item of items) {
      const { iconId, iconUrl, iconName } = item.icon;
      // Bundled icons carry an SVG data URI and never need registering, so the
      // cheap pattern test runs before any database lookup.
      if (!PORTABLE_ICON_PATTERN.test(iconUrl)) {
        repaired.push(item);
        continue;
      }
      if (iconId > 0 && (await getAssetByNumericId(iconId))) {
        repaired.push(item);
        continue;
      }
      try {
        const asset = await saveAssetFromDataUrl(iconName || item.name, iconUrl);
        changed = true;
        repaired.push({
          ...item,
          icon: {
            iconId: asset.numericId,
            iconName: asset.name,
            iconUrl: asset.dataUrl,
          },
        });
      } catch (error) {
        errorLog("Failed to register an inline template icon", error);
        repaired.push(item);
      }
    }
    return repaired;
  };

  const template = {
    ...stored.template,
    items: await repairItems(stored.template.items),
  };
  const stagingItems = await repairItems(stored.stagingItems);

  return changed
    ? { stored: { ...stored, template, stagingItems }, changed }
    : { stored, changed };
}

async function removeRecord(at: RecordLocation): Promise<void> {
  const database = await getLinkuDb();
  if (at.store === "drafts") await database.delete("drafts", DRAFT_SLOT_KEY);
  else await database.delete("templates", at.key);
}

async function writeRecord(
  at: RecordLocation,
  value: StoredTemplate,
): Promise<void> {
  const database = await getLinkuDb();
  if (at.store === "drafts") {
    await database.put("drafts", value, DRAFT_SLOT_KEY);
  } else {
    await database.put("templates", value, at.key);
  }
}

async function readStoredRecord(at: RecordLocation): Promise<unknown> {
  const database = await getLinkuDb();
  return at.store === "drafts"
    ? database.get("drafts", DRAFT_SLOT_KEY)
    : database.get("templates", at.key);
}

/**
 * Normalizes a record on read. Repairable damage is corrected in place;
 * anything else is moved to quarantine with its original bytes so the user
 * can still recover it, and reported as missing rather than shown broken.
 */
async function readRecord(at: RecordLocation): Promise<StoredTemplate | null> {
  const raw = await readStoredRecord(at);
  if (raw === undefined) return null;

  const result = normalizeStoredTemplate(raw);
  if (!result.value) {
    const reason = result.reason ?? "알 수 없는 오류";
    // The original is removed only once the copy is safely stored. If the
    // quarantine write failed, the damaged record stays where it is and this
    // read simply reports nothing — the next read tries again.
    if (await quarantineSafely({ at, reason, raw })) await removeRecord(at);
    errorLog(`Quarantined an unreadable ${at.store} record`, { at, reason });
    return null;
  }

  const { stored, changed } = await repairUnregisteredIcons(result.value);
  if (result.repairs.length > 0 || changed) {
    debugLog(`Repaired a stored ${at.store} record`, {
      at,
      repairs: result.repairs,
      registeredIcons: changed,
    });
    try {
      await writeRecord(at, stored);
    } catch (error) {
      // A failed rewrite only costs us the repair on the next read.
      errorLog("Failed to persist a repaired template record", error);
    }
  }

  return stored;
}

export async function saveTemplateToLocalStorage(
  template: Template,
  stagingItems: TemplateItem[] = [],
): Promise<StoredTemplate> {
  await ensureMigration();
  const database = await getLinkuDb();
  const transaction = database.transaction("templates", "readwrite");
  const store = transaction.objectStore("templates");

  try {
    const templateId =
      template.templateId === UNSAVED_TEMPLATE_ID
        ? await allocateMonotonicId(store)
        : template.templateId;

    const stored: StoredTemplate = {
      template: {
        ...template,
        templateId,
        id: template.id || crypto.randomUUID(),
        syncStatus: "local",
      },
      stagingItems,
      metadata: {
        lastSaved: Date.now(),
        savedLocally: true,
      },
    };

    await store.put(stored, templateId);
    await transaction.done;
    return stored;
  } catch (error) {
    errorLog("Failed to save template to IndexedDB", error);
    throw toStorageError(error, "브라우저 저장소에 저장하지 못했습니다.");
  }
}

export async function loadTemplateFromLocalStorage(
  templateId: number,
): Promise<StoredTemplate | null> {
  await ensureMigration();
  return templateId === UNSAVED_TEMPLATE_ID
    ? loadTemplateDraft()
    : readRecord({ store: "templates", key: templateId });
}

export async function getTemplatesIndex(): Promise<TemplateIndexEntry[]> {
  await ensureMigration();
  const database = await getLinkuDb();
  const keys = await database.getAllKeys("templates");
  const entries: TemplateIndexEntry[] = [];

  for (const key of keys) {
    const stored = await readRecord({ store: "templates", key });
    if (!stored) continue;
    entries.push({
      templateId: stored.template.templateId,
      name: stored.template.name,
      lastSaved: stored.metadata.lastSaved,
    });
  }

  return entries.sort((left, right) => right.lastSaved - left.lastSaved);
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

/**
 * The draft slot holds one in-progress edit, keyed separately from saved
 * templates. It is addressed through its own functions rather than through
 * `templateId === 0`, which elsewhere in the product means the bundled
 * default template.
 */
export async function saveTemplateDraft(
  template: Template,
  stagingItems: TemplateItem[] = [],
): Promise<void> {
  await ensureMigration();
  const database = await getLinkuDb();
  try {
    await database.put(
      "drafts",
      {
        template: {
          ...template,
          templateId: UNSAVED_TEMPLATE_ID,
          syncStatus: "local",
        },
        stagingItems,
        metadata: { lastSaved: Date.now(), savedLocally: true },
      },
      "current",
    );
  } catch (error) {
    errorLog("Failed to save template draft", error);
    throw toStorageError(error, "편집 중인 내용을 저장하지 못했습니다.");
  }
}

export async function loadTemplateDraft(): Promise<StoredTemplate | null> {
  await ensureMigration();
  return readRecord({ store: "drafts" });
}

export async function clearTemplateDraft(): Promise<void> {
  const database = await getLinkuDb();
  await database.delete("drafts", DRAFT_SLOT_KEY);
}

export function checkTemplateStorageAvailability(): {
  available: boolean;
  error?: string;
} {
  return typeof indexedDB !== "undefined"
    ? { available: true }
    : { available: false, error: "IndexedDB를 사용할 수 없습니다." };
}

export async function countTemplateItemsUsingIcon(
  iconNumericId: number,
): Promise<number> {
  const database = await getLinkuDb();
  const records = await database.getAll("templates");
  return records.reduce((total, record) => {
    const items = [...record.template.items, ...record.stagingItems];
    return (
      total + items.filter((item) => item.icon.iconId === iconNumericId).length
    );
  }, 0);
}

/**
 * Stores a copy of an existing template under a freshly allocated id.
 *
 * Used by both the gallery ("이 템플릿 추가") and shared-template imports, so
 * the id allocation and icon registration stay in one place.
 */
export async function importTemplateCopy(
  template: Template,
  stagingItems: TemplateItem[] = [],
): Promise<StoredTemplate> {
  await ensureMigration();

  // Icons are registered before the template is written so imported items are
  // editable the first time the user opens them.
  const { stored: withIcons } = await repairUnregisteredIcons({
    template,
    stagingItems,
    metadata: { lastSaved: Date.now(), savedLocally: true },
  });

  const database = await getLinkuDb();
  const transaction = database.transaction("templates", "readwrite");
  const store = transaction.objectStore("templates");

  try {
    const templateId = await allocateMonotonicId(store);
    const now = new Date().toISOString();
    const stored: StoredTemplate = {
      template: {
        ...withIcons.template,
        id: crypto.randomUUID(),
        templateId,
        name: withIcons.template.name.endsWith("(가져옴)")
          ? withIcons.template.name
          : `${withIcons.template.name} (가져옴)`,
        cloned: true,
        syncStatus: "local",
        createdAt: now,
        updatedAt: now,
      },
      stagingItems: withIcons.stagingItems,
      metadata: { lastSaved: Date.now(), savedLocally: true },
    };

    await store.put(stored, templateId);
    await transaction.done;
    return stored;
  } catch (error) {
    errorLog("Failed to store an imported template", error);
    throw toStorageError(error, "템플릿을 가져오지 못했습니다.");
  }
}

export async function importSharedTemplate(
  payload: TemplateSharePayloadV1,
  stagingItems: TemplateItem[] = [],
): Promise<StoredTemplate> {
  validateTemplateSharePayload(payload);
  return importTemplateCopy(portablePayloadToTemplate(payload), stagingItems);
}

export interface TemplateBackupV1 {
  kind: "linku-backup";
  version: 1;
  exportedAt: string;
  templates: StoredTemplate[];
  assets: Array<{ name: string; dataUrl: string }>;
}

/**
 * Exports every local template and icon.
 *
 * Sharing covers one template at a time; without a whole-store export a lost
 * Chrome profile takes every template with it, and no server holds a copy.
 */
export async function createTemplateBackup(): Promise<TemplateBackupV1> {
  await ensureMigration();
  const database = await getLinkuDb();
  const assets = await database.getAll("assets");

  return {
    kind: "linku-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: (
      await Promise.all(
        (await database.getAllKeys("templates")).map((key) =>
          readRecord({ store: "templates", key }),
        ),
      )
    ).filter((record): record is StoredTemplate => record !== null),
    assets: assets.map((asset) => ({ name: asset.name, dataUrl: asset.dataUrl })),
  };
}

export async function restoreTemplateBackup(
  value: unknown,
): Promise<{ imported: number; skipped: number }> {
  if (
    !value ||
    typeof value !== "object" ||
    (value as TemplateBackupV1).kind !== "linku-backup" ||
    (value as TemplateBackupV1).version !== 1 ||
    !Array.isArray((value as TemplateBackupV1).templates)
  ) {
    throw new Error("LinKU 백업 파일이 아닙니다.");
  }

  const backup = value as TemplateBackupV1;
  await ensureMigration();

  for (const asset of backup.assets ?? []) {
    try {
      await saveAssetFromDataUrl(asset.name, asset.dataUrl);
    } catch (error) {
      errorLog("Failed to restore a backed up icon", error);
    }
  }

  let imported = 0;
  let skipped = 0;

  // Restored templates always receive fresh ids. Reusing the stored id would
  // let a backup overwrite a template the user created after the export.
  for (const record of backup.templates) {
    const normalized = normalizeStoredTemplate(record);
    if (!normalized.value) {
      skipped += 1;
      continue;
    }
    try {
      await saveTemplateToLocalStorage(
        { ...normalized.value.template, templateId: UNSAVED_TEMPLATE_ID },
        normalized.value.stagingItems,
      );
      imported += 1;
    } catch (error) {
      errorLog("Failed to restore a backed up template", error);
      skipped += 1;
    }
  }

  return { imported, skipped };
}
