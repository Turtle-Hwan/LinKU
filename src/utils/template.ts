/**
 * Template utility functions - Grid-based coordinate system
 * All positions and sizes use grid units (0-5 for cols, 0-5 for rows)
 * Rendering conversion to pixels happens in components
 */

import type { TemplateItem, Icon, Position, Size } from '@/types/api';
import { LinkList } from '@/constants/LinkList';

/**
 * Grid configuration (6 columns × 6 rows)
 * Grid units for data, pixel values for rendering
 */
export const GRID_CONFIG = {
  // Grid dimensions
  COLS: 6,
  ROWS: 6,

  // Rendering constants (pixels)
  CANVAS_WIDTH_PX: 500,
  CANVAS_HEIGHT_PX: 396,
  CELL_WIDTH_PX: 69,   // Width of one grid cell
  CELL_HEIGHT_PX: 52,  // Height of one grid cell
  PADDING_PX: 12,
  GAP_PX: 12,
} as const;

/**
 * Convert grid position to pixel coordinates for rendering
 */
export function gridToPixelPosition(gridPos: Position): { x: number; y: number } {
  return {
    x: GRID_CONFIG.PADDING_PX + gridPos.x * (GRID_CONFIG.CELL_WIDTH_PX + GRID_CONFIG.GAP_PX),
    y: GRID_CONFIG.PADDING_PX + gridPos.y * (GRID_CONFIG.CELL_HEIGHT_PX + GRID_CONFIG.GAP_PX),
  };
}

/**
 * Convert grid size to pixel dimensions for rendering
 */
export function gridToPixelSize(gridSize: Size): { width: number; height: number } {
  return {
    width: gridSize.width * GRID_CONFIG.CELL_WIDTH_PX + (gridSize.width - 1) * GRID_CONFIG.GAP_PX,
    height: gridSize.height * GRID_CONFIG.CELL_HEIGHT_PX + (gridSize.height - 1) * GRID_CONFIG.GAP_PX,
  };
}

/**
 * Convert pixel position to grid coordinates (for drag end)
 */
export function pixelToGridPosition(pixelPos: { x: number; y: number }): Position {
  const gridX = Math.round((pixelPos.x - GRID_CONFIG.PADDING_PX) / (GRID_CONFIG.CELL_WIDTH_PX + GRID_CONFIG.GAP_PX));
  const gridY = Math.round((pixelPos.y - GRID_CONFIG.PADDING_PX) / (GRID_CONFIG.CELL_HEIGHT_PX + GRID_CONFIG.GAP_PX));

  // Clamp to grid bounds
  return {
    x: Math.max(0, Math.min(GRID_CONFIG.COLS - 1, gridX)),
    y: Math.max(0, Math.min(GRID_CONFIG.ROWS - 1, gridY)),
  };
}

/**
 * Convert pixel size to grid size (for resize)
 */
export function pixelToGridSize(pixelSize: { width: number; height: number }): Size {
  const gridWidth = Math.round(
    (pixelSize.width + GRID_CONFIG.GAP_PX) / (GRID_CONFIG.CELL_WIDTH_PX + GRID_CONFIG.GAP_PX)
  );
  const gridHeight = Math.round(
    (pixelSize.height + GRID_CONFIG.GAP_PX) / (GRID_CONFIG.CELL_HEIGHT_PX + GRID_CONFIG.GAP_PX)
  );

  // Clamp to valid sizes
  return {
    width: Math.max(1, Math.min(GRID_CONFIG.COLS, gridWidth)),
    height: Math.max(1, Math.min(GRID_CONFIG.ROWS, gridHeight)),
  };
}

/**
 * Check if item position and size are within grid bounds
 */
export function isWithinGridBounds(position: Position, size: Size): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + size.width <= GRID_CONFIG.COLS &&
    position.y + size.height <= GRID_CONFIG.ROWS
  );
}

/**
 * Clamp item position to stay within grid bounds considering its size
 */
export function clampToGridBounds(position: Position, size: Size): Position {
  return {
    x: Math.max(0, Math.min(GRID_CONFIG.COLS - size.width, position.x)),
    y: Math.max(0, Math.min(GRID_CONFIG.ROWS - size.height, position.y)),
  };
}

/**
 * Calculate grid position for LinkList item
 */
function calculateGridPosition(index: number, colSpan: number): { x: number; y: number } {
  const items = LinkList.map((item, i) => ({
    index: i,
    colSpan: item.islong ? 3 : 2,
  }));

  let currentCol = 0;
  let currentRow = 0;

  // Find position for this index
  for (let i = 0; i < index; i++) {
    const itemColSpan = items[i].colSpan;

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
function getIconIdentifier(linkItem: typeof LinkList[number]): string {
  const icon = linkItem.icon;

  // If icon is a Lucide component, try to get its name
  if (typeof icon === 'function') {
    // Lucide icons have displayName property
    const lucideName = (icon as any).displayName || icon.name;
    if (lucideName) {
      return lucideName.toLowerCase();
    }
  }

  // Fallback to label
  return linkItem.label.toLowerCase();
}

/**
 * Map LinkList icon to default icon using multiple matching strategies
 */
function findMatchingIcon(linkItem: typeof LinkList[number], defaultIcons: Icon[]): Icon {
  // Ensure defaultIcons is an array
  if (!Array.isArray(defaultIcons) || defaultIcons.length === 0) {
    console.warn('findMatchingIcon: defaultIcons is not a valid array');
    return {
      id: 0,
      name: 'default',
      imageUrl: '',
    };
  }

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
      '요람': 'scroll',
      '현장실습': 'building',
      '창업지원': 'lightbulb',
    };

    const mappedIconName = labelToIconMap[label];
    if (mappedIconName) {
      match = defaultIcons.find(icon =>
        icon.name.toLowerCase().includes(mappedIconName)
      );
    }
  }

  // Return match or first icon as fallback
  return match || defaultIcons[0] || {
    id: 0,
    name: 'default',
    imageUrl: '',
  };
}

/**
 * Convert LinkList to TemplateItems with grid coordinates
 */
export function convertLinkListToTemplateItems(defaultIcons: Icon[]): TemplateItem[] {
  // Validate that defaultIcons is an array
  if (!Array.isArray(defaultIcons)) {
    console.error('convertLinkListToTemplateItems: defaultIcons is not an array', defaultIcons);
    return [];
  }

  if (defaultIcons.length === 0) {
    console.warn('convertLinkListToTemplateItems: No default icons available');
    return [];
  }

  return LinkList.map((linkItem, index) => {
    const colSpan = linkItem.islong ? 3 : 2;
    const position = calculateGridPosition(index, colSpan);
    const size = calculateGridSize(colSpan);

    // Find matching icon - pass the entire linkItem for better matching
    const icon = findMatchingIcon(linkItem, defaultIcons);

    const templateItem: TemplateItem = {
      templateItemId: -(index + 1), // Temporary negative IDs for new items
      name: linkItem.label,
      siteUrl: linkItem.link,
      position: position, // Grid coordinates (0-5, 0-5)
      size: size,         // Grid size (width: 2-3, height: 1)
      icon: icon,
    };

    return templateItem;
  });
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
  direction: 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'
): Position | null {
  let newPos = { ...item.position };

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
  if (isWithinGridBounds(newPos, item.size)) {
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
  allItems: { templateItemId: number; position: Position; size: Size }[]
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
      const pushedPos = tryPushInDirection(overlappedItem, direction);

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

      if (swapOverlaps.length === 0 && isWithinGridBounds(originalPosition, overlappedItem.size)) {
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
        console.error('Collision resolution failed: items still overlap', finalItems[i], finalItems[j]);
        return null;
      }
    }
  }

  return positionChanges;
}
