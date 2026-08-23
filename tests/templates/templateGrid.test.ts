import assert from "node:assert/strict";
import test from "node:test";
import {
  clampToGridBounds,
  GRID_CONFIG,
  isWithinGridBounds,
  pixelToGridPosition,
  pixelToGridSize,
} from "../../src/utils/templateGrid.ts";

test("편집 좌표는 템플릿이 선언한 높이를 넘지 않는다", () => {
  const rowCount = 2;

  assert.deepEqual(
    pixelToGridPosition(
      { x: GRID_CONFIG.PADDING_PX, y: GRID_CONFIG.CANVAS_HEIGHT_PX },
      rowCount,
    ),
    { x: 0, y: 1 },
  );
  assert.deepEqual(
    clampToGridBounds({ x: 0, y: 5 }, { width: 1, height: 1 }, rowCount),
    { x: 0, y: 1 },
  );
});

test("편집 크기와 경계 판정은 템플릿 높이를 사용한다", () => {
  const rowCount = 2;

  assert.equal(
    pixelToGridSize(
      {
        width: GRID_CONFIG.CELL_WIDTH_PX,
        height: GRID_CONFIG.CANVAS_HEIGHT_PX,
      },
      rowCount,
    ).height,
    rowCount,
  );
  assert.equal(
    isWithinGridBounds(
      { x: 0, y: 2 },
      { width: 1, height: 1 },
      rowCount,
    ),
    false,
  );
});
