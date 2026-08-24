export type NetworkFailureKind =
  | "offline"
  | "aborted"
  | "blocked_or_unreachable"
  | "unknown";

function readNetworkError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "string") {
    return { name: "", message: error };
  }

  if (error && typeof error === "object") {
    try {
      const candidate = error as { name?: unknown; message?: unknown };
      return {
        name: typeof candidate.name === "string" ? candidate.name : "",
        message:
          typeof candidate.message === "string" ? candidate.message : "",
      };
    } catch {
      return { name: "", message: "" };
    }
  }

  return { name: "", message: "" };
}

export function classifyNetworkFailure(
  error: unknown,
  online: boolean | undefined = globalThis.navigator?.onLine,
): NetworkFailureKind {
  const { name, message } = readNetworkError(error);
  if (name === "AbortError" || /aborted|aborterror/iu.test(message)) {
    return "aborted";
  }

  const isFetchTransportFailure =
    (name === "TypeError" || name === "NetworkError") &&
    /failed to fetch|networkerror|network request failed|load failed/iu.test(
      message,
    );

  if (!isFetchTransportFailure) {
    return "unknown";
  }

  return online === false ? "offline" : "blocked_or_unreachable";
}

export function isExpectedNetworkFailure(
  error: unknown,
  online?: boolean,
): boolean {
  return classifyNetworkFailure(error, online) !== "unknown";
}
