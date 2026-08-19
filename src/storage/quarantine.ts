/**
 * Quarantine for records that fail read-time normalization.
 *
 * A personal template exists only on this device, so an unreadable record is
 * never dropped silently. It is moved out of the way with its original bytes
 * preserved, counted for the UI, and left for the user to export or discard.
 */

import { getLinkuDb, type QuarantinedRecord } from "@/storage/linkuDb";
import { errorLog } from "@/utils/logger";

/**
 * Upper bound on retained quarantine records. Damaged records still consume
 * the same storage budget as healthy ones, so the oldest entries give way
 * once the bound is reached.
 */
const MAX_QUARANTINE_RECORDS = 50;

export interface QuarantineInput {
  origin: QuarantinedRecord["origin"];
  key: number | string;
  reason: string;
  raw: unknown;
}

export async function quarantineRecord(input: QuarantineInput): Promise<void> {
  const database = await getLinkuDb();
  const transaction = database.transaction("quarantine", "readwrite");
  const store = transaction.objectStore("quarantine");

  await store.put({
    id: crypto.randomUUID(),
    origin: input.origin,
    key: input.key,
    reason: input.reason,
    quarantinedAt: Date.now(),
    raw: input.raw,
  });

  let cursor = await store.index("by-quarantined-at").openCursor();
  const overflow = (await store.count()) - MAX_QUARANTINE_RECORDS;
  for (let removed = 0; cursor && removed < overflow; removed += 1) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await transaction.done;
}

export async function listQuarantinedRecords(): Promise<QuarantinedRecord[]> {
  const database = await getLinkuDb();
  const records = await database.getAll("quarantine");
  return records.sort((left, right) => right.quarantinedAt - left.quarantinedAt);
}

export async function countQuarantinedRecords(): Promise<number> {
  const database = await getLinkuDb();
  return database.count("quarantine");
}

export async function deleteQuarantinedRecord(id: string): Promise<void> {
  const database = await getLinkuDb();
  await database.delete("quarantine", id);
}

/**
 * Moves a record aside without letting the failure surface as a product error.
 * The caller has already decided the record is unusable, and one damaged
 * record must not hide the templates that are still healthy.
 *
 * Returns whether the record was safely stored. A caller may only remove the
 * original after a `true`: dropping it when the quarantine write failed would
 * destroy the very data this store exists to preserve.
 */
export async function quarantineSafely(
  input: QuarantineInput,
): Promise<boolean> {
  try {
    await quarantineRecord(input);
    return true;
  } catch (error) {
    errorLog("Failed to quarantine damaged template record", error);
    return false;
  }
}
