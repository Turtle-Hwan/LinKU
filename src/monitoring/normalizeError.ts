export type NormalizedError = {
  error: Error;
  originalValue?: unknown;
};

function readErrorMessage(value: object): string | undefined {
  try {
    if (!("message" in value)) {
      return undefined;
    }

    const message = value.message;
    return typeof message === "string" && message.trim()
      ? message
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeError(
  value: unknown,
  fallbackMessage: string,
): NormalizedError {
  if (value instanceof Error) {
    return { error: value };
  }

  if (typeof value === "string" && value.trim()) {
    return { error: new Error(value) };
  }

  if (value && typeof value === "object") {
    const message = readErrorMessage(value);
    if (message) {
      return {
        error: new Error(message),
        originalValue: value,
      };
    }
  }

  return {
    error: new Error(fallbackMessage || "Unknown extension error"),
    originalValue: value,
  };
}
