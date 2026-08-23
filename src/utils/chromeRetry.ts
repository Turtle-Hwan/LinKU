export interface ChromeRetryOptions {
  maxAttempts: number;
  delayMs: number;
  shouldRetry(error: unknown): boolean;
  wait?: (delayMs: number) => Promise<void>;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    try {
      const message = (error as { message?: unknown }).message;
      return typeof message === "string" ? message : "";
    } catch {
      return "";
    }
  }
  return "";
}

export function isTransientTabEditError(error: unknown): boolean {
  return readErrorMessage(error).includes(
    "Tabs cannot be edited right now",
  );
}

export function isTransientChromeStorageLock(error: unknown): boolean {
  const message = readErrorMessage(error);
  return (
    message.includes("ChromeMethodBFE") &&
    (message.includes("LockFile") || message.includes("/LOCK"))
  );
}

const waitForDelay = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

export async function retryChromeOperation<T>(
  operation: () => Promise<T>,
  options: ChromeRetryOptions,
): Promise<T> {
  const wait = options.wait ?? waitForDelay;
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !options.shouldRetry(error)) {
        throw error;
      }
      await wait(options.delayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("Chrome operation retry exhausted unexpectedly");
}
