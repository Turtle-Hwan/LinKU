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
} from "@/storage/linkuDb";
import { errorLog } from "@/utils/logger";

export interface QuarantineInput {
  at: RecordLocation;
  reason: string;
  raw: unknown;
}

/**
 * The store is not capped. A quarantined record is moved out of `templates`
 * rather than copied, so the total never grows beyond what the user already
 * had, and evicting the oldest entries would destroy exactly what this store
 * exists to hold.
 */
export async function quarantineRecord(input: QuarantineInput): Promise<void> {
  const database = await getLinkuDb();
  await database.put("quarantine", {
    ...input,
    id: crypto.randomUUID(),
    quarantinedAt: Date.now(),
  });
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
