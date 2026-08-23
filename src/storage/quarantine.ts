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
  type QuarantineLocation,
  type RecordLocation,
} from "@/storage/linkuDb";
import { errorLog } from "@/utils/logger";

export interface QuarantineInput {
  at: QuarantineLocation;
  reason: string;
  raw: unknown;
}

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
  input: QuarantineInput & { at: RecordLocation },
): Promise<boolean> {
  try {
    const database = await getLinkuDb();
    const record: QuarantinedRecord = {
      ...input,
      id: crypto.randomUUID(),
      quarantinedAt: Date.now(),
    };

    const transaction = database.transaction(
      ["templates", "quarantine"],
      "readwrite",
    );
    await transaction.objectStore("quarantine").put(record);
    await transaction.objectStore("templates").delete(input.at.key);
    await transaction.done;

    return true;
  } catch (error) {
    errorLog("Failed to quarantine damaged template record", error);
    return false;
  }
}
