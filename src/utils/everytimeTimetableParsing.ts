export function isPrimaryEverytimeTable(
  primary?: string | null,
  isPrimary?: string | null,
): boolean {
  return primary?.trim() === "1" || isPrimary?.trim() === "1";
}
