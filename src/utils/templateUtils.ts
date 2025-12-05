/**
 * Template utility functions
 */

import type { TemplateItem } from '@/types/api';

/**
 * Compare two template items arrays for equality
 * Compares core fields only (excludes templateItemId which is server-assigned)
 */
export const areItemsEqual = (itemsA: TemplateItem[], itemsB: TemplateItem[]): boolean => {
  if (itemsA.length !== itemsB.length) return false;

  // 비교할 핵심 필드만 추출 (templateItemId 제외 - 서버 할당 값)
  const normalize = (item: TemplateItem) => ({
    name: item.name,
    siteUrl: item.siteUrl,
    position: item.position,
    size: item.size,
    iconId: item.icon?.iconId,
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
