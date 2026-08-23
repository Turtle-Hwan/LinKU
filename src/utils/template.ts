/**
 * Template utility functions - Grid-based coordinate system
 * All positions and sizes use grid units (0-5 for cols, 0-5 for rows)
 * Rendering conversion to pixels happens in components
 */

import type { TemplateItem, TemplateIcon, Icon, Position, Size } from '@/types/api';
import { LinkList, type LinkListElement } from '@/constants/LinkList';
import { BULLETIN_LINK_ID } from '@/constants/bulletin';
import { warnLog, errorLog } from '@/utils/logger';
import { GRID_CONFIG, isWithinGridBounds } from '@/utils/templateGrid';

/**
 * Calculate grid position for LinkList item
 */
function calculateGridPosition(
  index: number,
  colSpan: number,
  linkList: LinkListElement[],
): { x: number; y: number } {
  let currentCol = 0;
  let currentRow = 0;

  // Find position for this index
  for (let i = 0; i < index; i++) {
    const itemColSpan = linkList[i].islong ? 3 : 2;

    // Check if item fits in current row
    if (currentCol + itemColSpan > GRID_CONFIG.COLS) {
      currentCol = 0;
      currentRow++;
    }

    currentCol += itemColSpan;
  }

  // Check if current item fits in current row
  if (currentCol + colSpan > GRID_CONFIG.COLS) {
    currentCol = 0;
    currentRow++;
  }

  return { x: currentCol, y: currentRow };
}

/**
 * Calculate grid size based on column span
 */
function calculateGridSize(colSpan: number): { width: number; height: number } {
  return {
    width: colSpan,
    height: 1, // All items are 1 row tall
  };
}

/**
 * Extract icon identifier from LinkList item
 * For Lucide icons, use the component's displayName
 * For string/PNG icons, use the label
 */
function getIconIdentifier(linkItem: LinkListElement): string {
  const icon = linkItem.icon;

  // If icon is a Lucide component, try to get its name
  if (typeof icon === 'function') {
    // Lucide icons have displayName property
    const lucideName = icon.displayName || icon.name;
    if (lucideName) {
      return lucideName.toLowerCase();
    }
  }

  // Fallback to label
  return linkItem.label.toLowerCase();
}

/**
 * Map a LinkList entry to a bundled icon using several matching strategies.
 */
function findMatchingIcon(linkItem: LinkListElement, defaultIcons: Icon[]): Icon {
  // Get icon identifier from LinkList item
  const iconIdentifier = getIconIdentifier(linkItem);
  const label = linkItem.label.toLowerCase();

  // Strategy 1: Try exact match with icon identifier
  let match = defaultIcons.find(icon =>
    icon.name.toLowerCase() === iconIdentifier
  );

  // Strategy 2: Try contains match with icon identifier
  if (!match) {
    match = defaultIcons.find(icon =>
      icon.name.toLowerCase().includes(iconIdentifier) ||
      iconIdentifier.includes(icon.name.toLowerCase())
    );
  }

  // Strategy 3: Try label-based matching (Korean labels)
  if (!match) {
    const normalizedLabel = label.replace(/\s+/g, '');
    match = defaultIcons.find(icon => {
      const normalizedIconName = icon.name.toLowerCase().replace(/\s+/g, '');
      return normalizedIconName.includes(normalizedLabel) ||
             normalizedLabel.includes(normalizedIconName);
    });
  }

  // Strategy 4: Map specific labels to common icon names
  if (!match) {
    const labelToIconMap: Record<string, string> = {
      '홈페이지': 'home',
      '공지사항': 'bell',
      'ecampus': 'book',
      '위인전': 'trophy',
      '수강신청': 'clock',
      '캠퍼스맵': 'map',
      '학사정보시스템': 'graduation',
      '상허기념도서관': 'library',
      '학사일정': 'calendar',
      '학식 메뉴': 'utensils',
      '에브리타임': 'alarm',
      '학과 정보': 'users',
      '쿨하우스': 'bed',
      'kung': 'message',
      '현장실습': 'building',
      '창업지원': 'lightbulb',
    };

    const mappedIconName =
      linkItem.id === BULLETIN_LINK_ID ? 'scroll' : labelToIconMap[label];
    if (mappedIconName) {
      match = defaultIcons.find(icon =>
        icon.name.toLowerCase().includes(mappedIconName)
      );
    }
  }

  if (match) {
    return match;
  }

  warnLog(`findMatchingIcon: No match for "${linkItem.label}", using first bundled icon`);
  return defaultIcons[0];
}

/**
 * Convert LinkList entries to TemplateItems with bundled icons and grid coordinates.
 */
export function convertLinkListToTemplateItems(
  defaultIcons: Icon[],
  linkList: LinkListElement[] = LinkList,
): TemplateItem[] {
  if (defaultIcons.length === 0) {
    warnLog('convertLinkListToTemplateItems: No bundled icons available');
    return [];
  }

  const items: TemplateItem[] = [];

  linkList.forEach((linkItem, index) => {
    // Find the stable bundled icon for this link.
    const icon = findMatchingIcon(linkItem, defaultIcons);

    const colSpan = linkItem.islong ? 3 : 2;
    const position = calculateGridPosition(index, colSpan, linkList);
    const size = calculateGridSize(colSpan);

    items.push({
      templateItemId: -(index + 1), // Temporary negative IDs for new items
      name: linkItem.label,
      siteUrl: linkItem.link,
      position: position, // Grid coordinates (0-5, 0-5)
      size: size,         // Grid size (width: 2-3, height: 1)
      icon: {
        iconId: icon.id,
        iconName: icon.name,
        iconUrl: icon.imageUrl,
      } as TemplateIcon,
    });
  });

  return items;
}

/**
 * Calculate template height in grid rows (always 6)
 */
export function calculateTemplateHeight(): number {
  return GRID_CONFIG.ROWS;
}

/**
 * Check if two items overlap
 */
export function checkOverlap(
  pos1: Position,
  size1: Size,
  pos2: Position,
  size2: Size
): boolean {
  const xOverlap =
    pos1.x < pos2.x + size2.width && pos1.x + size1.width > pos2.x;
  const yOverlap =
    pos1.y < pos2.y + size2.height && pos1.y + size1.height > pos2.y;
  return xOverlap && yOverlap;
}

/**
 * Find all items that overlap with given position and size
 */
export function findOverlappingItems(
  position: Position,
  size: Size,
  allItems: { position: Position; size: Size; templateItemId: number }[],
  excludeId?: number
): typeof allItems {
  return allItems.filter(
    (item) =>
      item.templateItemId !== excludeId &&
      checkOverlap(position, size, item.position, item.size)
  );
}

/**
 * Try to push an item in a direction by 1 grid cell
 * Returns new position if successful, null if impossible
 */
function tryPushInDirection(
  item: { position: Position; size: Size },
  direction: 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right',
  rowCount: number,
): Position | null {
  const newPos = { ...item.position };

  // Move by exactly 1 grid cell in the specified direction
  switch (direction) {
    case 'up':
      newPos.y -= 1;
      break;
    case 'down':
      newPos.y += 1;
      break;
    case 'left':
      newPos.x -= 1;
      break;
    case 'right':
      newPos.x += 1;
      break;
    case 'up-left':
      newPos.y -= 1;
      newPos.x -= 1;
      break;
    case 'up-right':
      newPos.y -= 1;
      newPos.x += 1;
      break;
    case 'down-left':
      newPos.y += 1;
      newPos.x -= 1;
      break;
    case 'down-right':
      newPos.y += 1;
      newPos.x += 1;
      break;
  }

  // Check if new position is within bounds
  if (isWithinGridBounds(newPos, item.size, rowCount)) {
    return newPos;
  }

  return null;
}

/**
 * Get prioritized directions based on push direction
 * Returns array of directions, with primary push direction first
 */
function getPrioritizedDirections(
  deltaX: number,
  deltaY: number
): Array<'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'> {
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  // Determine primary and secondary directions based on delta magnitudes
  let primary: 'up' | 'down' | 'left' | 'right';
  let secondary: 'up' | 'down' | 'left' | 'right';

  // Primary direction (larger delta)
  if (absDeltaX > absDeltaY) {
    primary = deltaX > 0 ? 'right' : 'left';
    secondary = deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : (deltaX > 0 ? 'right' : 'left');
  } else {
    primary = deltaY > 0 ? 'down' : 'up';
    secondary = deltaX > 0 ? 'right' : deltaX < 0 ? 'left' : (deltaY > 0 ? 'down' : 'up');
  }

  // Build prioritized list: primary, diagonal combinations, secondary, opposite diagonal, opposite primary
  const directions: Array<'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'> = [
    primary,
  ];

  // Add diagonal in primary direction
  if (primary === 'right' && secondary === 'down') directions.push('down-right');
  else if (primary === 'right' && secondary === 'up') directions.push('up-right');
  else if (primary === 'left' && secondary === 'down') directions.push('down-left');
  else if (primary === 'left' && secondary === 'up') directions.push('up-left');
  else if (primary === 'down' && secondary === 'right') directions.push('down-right');
  else if (primary === 'down' && secondary === 'left') directions.push('down-left');
  else if (primary === 'up' && secondary === 'right') directions.push('up-right');
  else if (primary === 'up' && secondary === 'left') directions.push('up-left');

  // Add secondary direction
  if (secondary !== primary) {
    directions.push(secondary);
  }

  // Add remaining diagonal (opposite to first diagonal)
  if (primary === 'right' && secondary === 'down') directions.push('up-right');
  else if (primary === 'right' && secondary === 'up') directions.push('down-right');
  else if (primary === 'left' && secondary === 'down') directions.push('up-left');
  else if (primary === 'left' && secondary === 'up') directions.push('down-left');
  else if (primary === 'down' && secondary === 'right') directions.push('down-left');
  else if (primary === 'down' && secondary === 'left') directions.push('down-right');
  else if (primary === 'up' && secondary === 'right') directions.push('up-left');
  else if (primary === 'up' && secondary === 'left') directions.push('up-right');

  return directions;
}

/**
 * Resolve collisions by pushing overlapping items away
 * New logic: Only push items by 1 grid cell, prioritize adjacent spaces
 * Also supports swapping positions when no adjacent space is available
 * Returns updated positions for all affected items, or null if resolution impossible
 */
export function resolveCollisions(
  movingItemId: number,
  newPosition: Position,
  allItems: { templateItemId: number; position: Position; size: Size }[],
  rowCount: number,
): Map<number, Position> | null {
  const movingItem = allItems.find((item) => item.templateItemId === movingItemId);
  if (!movingItem) return null;

  const originalPosition = movingItem.position;

  // Create a map to track position changes
  const positionChanges = new Map<number, Position>();
  positionChanges.set(movingItemId, newPosition);

  // Get current items with updated position for moving item
  const getCurrentItems = () =>
    allItems.map((item) => ({
      ...item,
      position: positionChanges.get(item.templateItemId) || item.position,
    }));

  // Find overlapping items
  const overlapping = findOverlappingItems(
    newPosition,
    movingItem.size,
    getCurrentItems(),
    movingItemId
  );

  // If no overlaps, we're done
  if (overlapping.length === 0) {
    return positionChanges;
  }

  // Try to push each overlapping item (only 1 grid cell away)
  for (const overlappedItem of overlapping) {
    // Calculate push direction based on relative positions
    const deltaX = newPosition.x - overlappedItem.position.x;
    const deltaY = newPosition.y - overlappedItem.position.y;

    // Get prioritized directions (primary direction first, then adjacent)
    const directions = getPrioritizedDirections(deltaX, deltaY);

    // Try each direction until we find one that works (within 1 grid cell range)
    let pushed = false;
    for (const direction of directions) {
      const pushedPos = tryPushInDirection(overlappedItem, direction, rowCount);

      if (pushedPos) {
        // Check if this new position causes overlap with other items
        const otherItems = getCurrentItems().filter(
          (item) => item.templateItemId !== overlappedItem.templateItemId
        );
        const newOverlaps = findOverlappingItems(
          pushedPos,
          overlappedItem.size,
          otherItems
        );

        if (newOverlaps.length === 0) {
          // Success! This position works
          positionChanges.set(overlappedItem.templateItemId, pushedPos);
          pushed = true;
          break;
        }
      }
    }

    // If we couldn't push to adjacent space, try swapping positions
    if (!pushed) {
      // Check if overlapped item can fit in moving item's original position
      // IMPORTANT: Use current positions (not original) to check for overlaps
      const otherItemsExcludingBoth = getCurrentItems().filter(
        (item) =>
          item.templateItemId !== movingItemId &&
          item.templateItemId !== overlappedItem.templateItemId
      );

      const swapOverlaps = findOverlappingItems(
        originalPosition,
        overlappedItem.size,
        otherItemsExcludingBoth
      );

      if (
        swapOverlaps.length === 0 &&
        isWithinGridBounds(originalPosition, overlappedItem.size, rowCount)
      ) {
        // Swap is possible!
        positionChanges.set(overlappedItem.templateItemId, originalPosition);
        pushed = true;
      }
    }

    // If we couldn't push this item or swap, collision resolution failed
    if (!pushed) {
      return null;
    }
  }

  // Final validation: ensure no items overlap after all position changes
  const finalItems = getCurrentItems();
  for (let i = 0; i < finalItems.length; i++) {
    for (let j = i + 1; j < finalItems.length; j++) {
      if (checkOverlap(
        finalItems[i].position,
        finalItems[i].size,
        finalItems[j].position,
        finalItems[j].size
      )) {
        // Items still overlap after resolution - this should never happen
        // but if it does, reject the entire operation
        errorLog('Collision resolution failed: items still overlap', finalItems[i], finalItems[j]);
        return null;
      }
    }
  }

  return positionChanges;
}
