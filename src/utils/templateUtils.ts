/**
 * Template utility functions
 */

import type { TemplateItem, PostedTemplateItem } from '@/types/api';

/**
 * Common item interface for comparison
 * Supports both TemplateItem and PostedTemplateItem
 */
interface ComparableItem {
  name: string;
  siteUrl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  icon?: { iconId?: number; iconUrl?: string; iconName?: string };
}

/**
 * Compare two template items arrays for equality
 * Compares core fields only (excludes IDs which are server-assigned)
 * Works with both TemplateItem and PostedTemplateItem
 */
export const areItemsEqual = (
  itemsA: (TemplateItem | PostedTemplateItem | ComparableItem)[],
  itemsB: (TemplateItem | PostedTemplateItem | ComparableItem)[]
): boolean => {
  if (itemsA.length !== itemsB.length) return false;

  // 비교할 핵심 필드만 추출 (ID 제외 - 서버 할당 값)
  const normalize = (item: ComparableItem) => ({
    name: item.name,
    siteUrl: item.siteUrl,
    position: item.position,
    size: item.size,
    // icon 비교: iconUrl 또는 iconName 사용 (iconId는 PostedTemplateItem에 없음)
    iconIdentifier: item.icon?.iconUrl || item.icon?.iconName || item.icon?.iconId,
  });

  // position 기준 정렬 (row -> col 순)
  const sortByPosition = (a: ReturnType<typeof normalize>, b: ReturnType<typeof normalize>) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  };

  const normA = itemsA.map(normalize).sort(sortByPosition);
  const normB = itemsB.map(normalize).sort(sortByPosition);

  return JSON.stringify(normA) === JSON.stringify(normB);
};
