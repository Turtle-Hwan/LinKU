// Shared by popup, extension pages and the background's session changes.
export function withAccountLock<T>(operation: () => Promise<T>): Promise<T> {
  return navigator.locks.request("linku-account", operation);
}
