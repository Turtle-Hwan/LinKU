/**
 * Template grid bounds.
 *
 * Kept in a leaf module so storage-layer validation can share the numbers
 * with the renderer without pulling React or icon rendering along with them.
 */
export const GRID_COLUMNS = 6;
export const GRID_ROWS = 6;
export const MAX_TEMPLATE_ITEMS = GRID_COLUMNS * GRID_ROWS;
