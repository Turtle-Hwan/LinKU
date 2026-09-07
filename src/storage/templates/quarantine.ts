/**
 * Quarantine for records that fail read-time normalization.
 *
 * A personal template exists only on this device, so an unreadable record is
 * never dropped silently. It is moved out of the way with its original bytes
 * preserved, counted for the UI, and left for the user to export or discard.
 */

import {
  getLinkuDb,
  type QuarantinedRecord,
  type RecordLocation,
} from "@/storage/indexedDb/linkuDatabase";
import { captureErrorLog } from "@/utils/logger";
import { normalizeStoredTemplate } from "@/storage/templates/record";

/**
 * The store is not capped. Evicting the oldest entries would destroy exactly
 * what this store exists to hold.
 */
export async function listQuarantinedRecords(): Promise<QuarantinedRecord[]> {
  const database = await getLinkuDb();
  const records = await database.getAll("quarantine");
  return records.sort((left, right) => right.quarantinedAt - left.quarantinedAt);
}

export async function countQuarantinedRecords(): Promise<number> {
  const database = await getLinkuDb();
  return database.count("quarantine");
}

/**
 * Atomically moves a live IndexedDB record aside without letting the failure
 * surface as a product error. A legacy localStorage record is copied by the
 * migration transaction instead because it has no IndexedDB source to delete.
 *
 * Returns whether the record was safely moved. The source and quarantine write
 * share one transaction, so a crash cannot leave duplicates or drop the only
 * recoverable copy.
 */
export async function moveRecordToQuarantineSafely(
  at: RecordLocation,
): Promise<boolean> {
  try {
    const database = await getLinkuDb();
    const transaction = database.transaction(
      ["templates", "quarantine"],
      "readwrite",
    );
    const current = await transaction.objectStore("templates").get(at.key);
    const normalized = normalizeStoredTemplate(current, { expectedTemplateId: at.key });
    if (current === undefined || normalized.value) {
      await transaction.done;
      return false;
    }
    const record: QuarantinedRecord = {
      at,
      raw: current,
      reason: normalized.reason ?? "알 수 없는 오류",
      id: crypto.randomUUID(),
      quarantinedAt: Date.now(),
    };
    await transaction.objectStore("quarantine").put(record);
    await transaction.objectStore("templates").delete(at.key);
    await transaction.done;

    return true;
  } catch (error) {
    captureErrorLog("Failed to quarantine damaged template record", error);
    return false;
  }
}
