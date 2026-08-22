/**
 * Source of descending keys — an object store or one of its indexes.
 * Declared structurally so the allocator works with either.
 */
interface DescendingKeySource {
  openCursor(
    query: null,
    direction: "prev",
  ): Promise<{ key: IDBValidKey } | null>;
}

/**
 * Allocates an id that no record in `source` holds, from inside the caller's
 * transaction.
 *
 * The clock alone is not a safe source. A system clock that moves backwards —
 * a manual change, an NTP correction — would hand out an id that already
 * belongs to a record, and `put` overwrites without a trace. Allocation
 * therefore starts above the highest id in use, and must run in the same
 * transaction as the write that consumes it so no concurrent save can claim
 * the same id in between.
 */
export async function allocateMonotonicId(
  source: DescendingKeySource,
): Promise<number> {
  const candidate = Date.now();
  const newest = await source.openCursor(null, "prev");
  return newest && Number(newest.key) >= candidate
    ? Number(newest.key) + 1
    : candidate;
}
