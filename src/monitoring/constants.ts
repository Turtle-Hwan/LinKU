export const MONITORING_FLUSH_TIMEOUT_MS = 2_000;
export const MONITORING_MAX_BREADCRUMBS = 200;
export const MONITORING_MAX_VALUE_LENGTH = 1_000;
export const MONITORING_NORMALIZE_DEPTH = 6;
export const MONITORING_NORMALIZE_MAX_BREADTH = 100;

// MV3 tears the service worker down while tab listeners are still settling, so
// the rejection describes browser lifecycle rather than a LinKU failure. The
// console warning stays; only the collector drops it.
export const MONITORING_IGNORED_ERROR_MESSAGES = [
  "The browser is shutting down.",
];
