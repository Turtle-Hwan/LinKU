/**
 * The rules that define a template: what it may contain, and how an unsaved
 * one is spelled.
 *
 * Kept in a leaf module so the storage layer, the share codec and the renderer
 * validate against the same numbers without pulling React or icon rendering
 * along with them.
 */

/**
 * Id of a template that the storage layer has not given an id yet — a new
 * template in the editor, or the bundled default shown in the list. Saving one
 * allocates a real id; it is never written under this value.
 */
export const UNSAVED_TEMPLATE_ID = 0;

export const GRID_COLUMNS = 6;
export const GRID_ROWS = 6;
export const MAX_TEMPLATE_ITEMS = GRID_COLUMNS * GRID_ROWS;
export const MAX_TEMPLATE_NAME_LENGTH = 80;
export const MAX_SITE_URL_LENGTH = 2_048;

/**
 * Icon images that may travel inside a shared template or be registered as an
 * asset. SVG is excluded on purpose: it can carry script.
 */
export const PORTABLE_ICON_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,/u;
