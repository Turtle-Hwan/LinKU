export const TODO_BADGE_BACKGROUND_COLOR = "#00913A";
export const TODO_BADGE_TEXT_COLOR = "#FFFFFF";

export function formatTodoBadgeCount(count: number): string {
  if (count <= 0) {
    return "";
  }

  return count > 99 ? "99+" : String(count);
}
