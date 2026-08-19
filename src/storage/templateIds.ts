import type { WritableTemplateStore } from "./linkuDb.ts";

/**
 * Allocates an unused template id from inside the caller's transaction.
 *
 * The clock alone is not a safe source. A system clock that moves backwards —
 * a manual change, an NTP correction — would hand out an id that already
 * belongs to a template, and `put` overwrites without a trace. Allocation
 * therefore starts above the highest id in use, and runs in the same
 * transaction as the write that consumes it so no concurrent save can claim
 * the same id in between.
 */
export async function allocateTemplateId(
  store: WritableTemplateStore,
): Promise<number> {
  let candidate = Date.now();
  const newest = await store.openCursor(null, "prev");
  if (newest && Number(newest.key) >= candidate) {
    candidate = Number(newest.key) + 1;
  }
  return candidate;
}
