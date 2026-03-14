export interface PlatformCapabilities {
  hasChromeRuntime: boolean;
  hasChromeStorage: boolean;
  hasWindow: boolean;
}

interface ChromeLike {
  runtime?: { id?: string };
  storage?: unknown;
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const chromeApi = (
    globalThis as typeof globalThis & { chrome?: ChromeLike }
  ).chrome;
  const chromeRuntime = typeof chromeApi?.runtime?.id === "string";

  return {
    hasChromeRuntime: chromeRuntime,
    hasChromeStorage: typeof chromeApi?.storage !== "undefined",
    hasWindow: typeof window !== "undefined",
  };
}

export function hasChromeExtensionRuntime(): boolean {
  return getPlatformCapabilities().hasChromeRuntime;
}
