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

import { restoreAssetFromDataUrl } from "@/storage/assetRepository";
import {
  getLinkuDb,
  type RecordLocation,
  type StoredTemplate,
} from "@/storage/linkuDb";
import { UNSAVED_TEMPLATE_ID } from "@/constants/template";
import { moveRecordToQuarantineSafely } from "@/storage/quarantine";
import { allocateMonotonicId } from "@/storage/monotonicId";
import {
  migrateLegacyTemplates,
  removeLegacyTemplateSource,
} from "@/storage/legacyTemplateStorage";
import { repairTemplateIcons } from "@/storage/templateIconRepair";
import {
  formatImportedTemplateName,
  normalizeTemplateName,
  normalizeStoredTemplate,
} from "@/storage/templateRecord";
import {
  assertTemplateBackupSize,
  parseTemplateBackup,
  prepareRestoredTemplate,
  selectReferencedBackupAssets,
  type RestoredAssetReference,
  type TemplateBackupV1,
} from "@/storage/templateBackup";
import type { Template, TemplateItem } from "@/types/api";
import { debugLog, errorLog, warnLog } from "@/utils/logger";
import { portablePayloadToTemplate } from "@/utils/templateShare";
import {
  validateTemplateSharePayload,
  validateTemplateSharePayloadImages,
} from "@/utils/templateShareCodec";
import type { TemplateSharePayloadV1 } from "@/types/templateShare";

export {
  isTemplateBackupValidationError,
  MAX_TEMPLATE_BACKUP_BYTES,
} from "@/storage/templateBackup";
export {
  countQuarantinedRecords,
  listQuarantinedRecords,
} from "@/storage/quarantine";

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

async function ensureMigration(): Promise<void> {
  const migration = migrationPromise ?? migrateLegacyTemplates();
  migrationPromise = migration;
  try {
    await migration;
  } catch (error) {
    if (migrationPromise === migration) {
      migrationPromise = undefined;
      errorLog("Legacy template migration failed", error);
    }
    throw error;
  }
}

async function writeRecord(
  at: RecordLocation,
  value: StoredTemplate,
): Promise<void> {
  const database = await getLinkuDb();
  await database.put("templates", value, at.key);
}

async function readStoredRecord(at: RecordLocation): Promise<unknown> {
  const database = await getLinkuDb();
  return database.get("templates", at.key);
}

/**
 * Normalizes a record on read. Repairable damage is corrected in place;
 * anything else is moved to quarantine with its original bytes so the user
 * can still recover it, and reported as missing rather than shown broken.
 */
async function readRecord(at: RecordLocation): Promise<StoredTemplate | null> {
  const raw = await readStoredRecord(at);
  if (raw === undefined) return null;

  const result = normalizeStoredTemplate(raw, {
    expectedTemplateId: at.key,
  });
  if (!result.value) {
    const reason = result.reason ?? "알 수 없는 오류";
    if (await moveRecordToQuarantineSafely({ at, reason, raw })) {
      warnLog(`Quarantined an unreadable ${at.store} record`, { at, reason });
    }
    return null;
  }

  const { stored, changed } = await repairTemplateIcons(result.value);
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

export async function saveLocalTemplate(
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
        name: normalizeTemplateName(template.name),
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
    throw toStorageError(error, "브라우저 저장소에 저장하지 못했습니다.");
  }
}

export async function getLocalTemplate(
  templateId: number,
): Promise<StoredTemplate | null> {
  await ensureMigration();
  if (templateId === UNSAVED_TEMPLATE_ID) return null;
  return readRecord({ store: "templates", key: templateId });
}

export async function listLocalTemplates(): Promise<StoredTemplate[]> {
  await ensureMigration();
  const database = await getLinkuDb();
  const keys = await database.getAllKeys("templates");
  const records = await Promise.all(
    keys.map((key) => readRecord({ store: "templates", key })),
  );
  return records
    .filter((record): record is StoredTemplate => record !== null)
    .sort((left, right) => right.metadata.lastSaved - left.metadata.lastSaved);
}

export async function deleteLocalTemplate(
  templateId: number,
): Promise<void> {
  await ensureMigration();
  // Remove the rollback source before IndexedDB. If this write is blocked,
  // keep the active record rather than reporting a deletion that can later
  // reappear during a fresh migration.
  removeLegacyTemplateSource(templateId);

  const database = await getLinkuDb();
  await database.delete("templates", templateId);
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
  const repaired = await repairTemplateIcons(
    {
      template,
      stagingItems,
      metadata: { lastSaved: Date.now(), savedLocally: true },
    },
    { reportRegistrationFailures: false },
  );
  if (repaired.failedRegistrations > 0) {
    throw toStorageError(
      repaired.firstRegistrationError,
      "템플릿의 사용자 아이콘을 저장하지 못했습니다.",
    );
  }
  const withIcons = repaired.stored;

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
        name: formatImportedTemplateName(withIcons.template.name),
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
    throw toStorageError(error, "템플릿을 가져오지 못했습니다.");
  }
}

export async function importSharedTemplate(
  payload: TemplateSharePayloadV1,
  stagingItems: TemplateItem[] = [],
): Promise<StoredTemplate> {
  validateTemplateSharePayload(payload);
  await validateTemplateSharePayloadImages(payload);
  return importTemplateCopy(portablePayloadToTemplate(payload), stagingItems);
}

/**
 * Exports every local template and the user icons those records reference.
 *
 * Sharing covers one template at a time; without a whole-store export a lost
 * Chrome profile takes every template with it, and no server holds a copy.
 */
export async function createTemplateBackup(): Promise<
  TemplateBackupV1<StoredTemplate>
> {
  await ensureMigration();
  const database = await getLinkuDb();
  const templates = (
    await Promise.all(
      (await database.getAllKeys("templates")).map((key) =>
        readRecord({ store: "templates", key }),
      ),
    )
  ).filter((record): record is StoredTemplate => record !== null);
  const assets = selectReferencedBackupAssets(
    templates,
    await database.getAll("assets"),
  );

  const backup: TemplateBackupV1<StoredTemplate> = {
    kind: "linku-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    templates,
    assets: assets.map((asset) => ({ name: asset.name, dataUrl: asset.dataUrl })),
  };

  // Never offer a successful download that this same release refuses to
  // restore. The UI surfaces the actionable size error from this boundary.
  assertTemplateBackupSize(backup);
  return backup;
}

export async function restoreTemplateBackup(
  value: unknown,
): Promise<{ imported: number; skipped: number; failedAssets: number }> {
  const backup = parseTemplateBackup(value);
  await ensureMigration();

  const restoredAssets = new Map<string, RestoredAssetReference>();
  let failedAssets = 0;
  let firstAssetError: unknown;
  for (const asset of backup.assets ?? []) {
    try {
      const restored = await restoreAssetFromDataUrl(asset.name, asset.dataUrl);
      restoredAssets.set(asset.dataUrl, {
        numericId: restored.numericId,
        name: restored.name,
        dataUrl: restored.dataUrl,
      });
    } catch (error) {
      failedAssets += 1;
      firstAssetError ??= error;
    }
  }

  let imported = 0;
  let skipped = 0;
  let firstTemplateError: unknown;

  // Restored templates receive a fresh local id and stable UUID. The UUID is
  // also the optional account-sync key, so reusing it would let a repeated or
  // second-device restore overwrite an existing remote template.
  for (const record of backup.templates) {
    const prepared = prepareRestoredTemplate(record, restoredAssets);
    if (!prepared) {
      skipped += 1;
      continue;
    }
    try {
      // A backup may omit an asset that is still embedded in a template. The
      // normal repair path registers it before the record becomes visible.
      const repaired = await repairTemplateIcons(prepared, {
        reportRegistrationFailures: false,
      });
      failedAssets += repaired.failedRegistrations;
      firstAssetError ??= repaired.firstRegistrationError;
      await saveLocalTemplate(
        repaired.stored.template,
        repaired.stored.stagingItems,
      );
      imported += 1;
    } catch (error) {
      firstTemplateError ??= error;
      skipped += 1;
    }
  }

  if (failedAssets > 0) {
    errorLog("Failed to restore backed up icons", firstAssetError, {
      failed_assets: failedAssets,
    });
  }
  if (firstTemplateError !== undefined) {
    errorLog("Failed to restore backed up templates", firstTemplateError, {
      skipped_templates: skipped,
    });
  }

  return { imported, skipped, failedAssets };
}
