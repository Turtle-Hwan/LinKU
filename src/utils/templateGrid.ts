import { GRID_COLUMNS, GRID_ROWS } from "@/constants/template";
import type { Position, Size } from "@/types/api";

/** Grid units for data and pixel values for editor/preview rendering. */
export const GRID_CONFIG = {
  COLS: GRID_COLUMNS,
  ROWS: GRID_ROWS,
  CANVAS_WIDTH_PX: 500,
  CANVAS_HEIGHT_PX: 396,
  CELL_WIDTH_PX: 69,
  CELL_HEIGHT_PX: 52,
  PADDING_PX: 12,
  GAP_PX: 12,
} as const;

export function gridToPixelPosition(gridPos: Position): Position {
  return {
    x:
      GRID_CONFIG.PADDING_PX +
      gridPos.x * (GRID_CONFIG.CELL_WIDTH_PX + GRID_CONFIG.GAP_PX),
    y:
      GRID_CONFIG.PADDING_PX +
      gridPos.y * (GRID_CONFIG.CELL_HEIGHT_PX + GRID_CONFIG.GAP_PX),
  };
}

export function gridToPixelSize(gridSize: Size): Size {
  return {
    width:
      gridSize.width * GRID_CONFIG.CELL_WIDTH_PX +
      (gridSize.width - 1) * GRID_CONFIG.GAP_PX,
    height:
      gridSize.height * GRID_CONFIG.CELL_HEIGHT_PX +
      (gridSize.height - 1) * GRID_CONFIG.GAP_PX,
  };
}

export function pixelToGridPosition(pixelPos: Position): Position {
  const gridX = Math.round(
    (pixelPos.x - GRID_CONFIG.PADDING_PX) /
      (GRID_CONFIG.CELL_WIDTH_PX + GRID_CONFIG.GAP_PX),
  );
  const gridY = Math.round(
    (pixelPos.y - GRID_CONFIG.PADDING_PX) /
      (GRID_CONFIG.CELL_HEIGHT_PX + GRID_CONFIG.GAP_PX),
  );
  return {
    x: Math.max(0, Math.min(GRID_CONFIG.COLS - 1, gridX)),
    y: Math.max(0, Math.min(GRID_CONFIG.ROWS - 1, gridY)),
  };
}

export function pixelToGridSize(pixelSize: Size): Size {
  const gridWidth = Math.round(
    (pixelSize.width + GRID_CONFIG.GAP_PX) /
      (GRID_CONFIG.CELL_WIDTH_PX + GRID_CONFIG.GAP_PX),
  );
  const gridHeight = Math.round(
    (pixelSize.height + GRID_CONFIG.GAP_PX) /
      (GRID_CONFIG.CELL_HEIGHT_PX + GRID_CONFIG.GAP_PX),
  );
  return {
    width: Math.max(1, Math.min(GRID_CONFIG.COLS, gridWidth)),
    height: Math.max(1, Math.min(GRID_CONFIG.ROWS, gridHeight)),
  };
}

export function isWithinGridBounds(position: Position, size: Size): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + size.width <= GRID_CONFIG.COLS &&
    position.y + size.height <= GRID_CONFIG.ROWS
  );
}

export function clampToGridBounds(position: Position, size: Size): Position {
  return {
    x: Math.max(0, Math.min(GRID_CONFIG.COLS - size.width, position.x)),
    y: Math.max(0, Math.min(GRID_CONFIG.ROWS - size.height, position.y)),
  };
}
