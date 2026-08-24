export const capturedErrors: unknown[][] = [];
export const consoleWarnings: unknown[][] = [];
export const breadcrumbs: unknown[][] = [];

export function resetRuntimeStubs(): void {
  capturedErrors.length = 0;
  consoleWarnings.length = 0;
  breadcrumbs.length = 0;
}

export function captureErrorLog(...args: unknown[]): void {
  capturedErrors.push(args);
}

export function warnLog(...args: unknown[]): void {
  consoleWarnings.push(args);
}

export function recordBreadcrumb(...args: unknown[]): void {
  breadcrumbs.push(args);
}
