const IS_DEV = import.meta.env.DEV;

const MAX_STRING_LENGTH = 400;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_KEYS = 20;
const MAX_DEPTH = 4;
const REDACTED = "[REDACTED]";
const TRUNCATED_ARRAY_META_KEY = "__truncated_items__";
const TRUNCATED_OBJECT_META_KEY = "__truncated_keys__";

const EMAIL_PATTERN =
  /\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
const BEARER_PATTERN = /Bearer\s+[-A-Z0-9._~+/=]+/gi;
const TOKEN_QUERY_PATTERN =
  /([?&#])(code|access_token|refresh_token|id_token|token)=([^&#\s]+)/gi;
const SENSITIVE_KEY_PATTERN =
  /accessToken|refreshToken|guestToken|idToken|secret|authorization|cookie|password|apiKey/i;

type LogLevel = "debug" | "info" | "warn" | "error";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeString(value: string): string {
  const maskedEmail = value.replace(
    EMAIL_PATTERN,
    (_, firstChar: string, _middle: string, domain: string) =>
      `${firstChar}***${domain}`,
  );

  const maskedBearer = maskedEmail.replace(BEARER_PATTERN, "Bearer [REDACTED]");

  const maskedQuery = maskedBearer.replace(
    TOKEN_QUERY_PATTERN,
    (_match, separator: string, key: string) => `${separator}${key}=${REDACTED}`,
  );

  return maskedQuery.length > MAX_STRING_LENGTH
    ? `${maskedQuery.slice(0, MAX_STRING_LENGTH)}...`
    : maskedQuery;
}

function sanitizeValue(
  value: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return sanitizeString(value.toString());
  }

  if (value instanceof Error) {
    return getErrorLogDetails(value);
  }

  if (depth >= MAX_DEPTH) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const sanitizedEntries = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeValue(entry, depth + 1, seen));
    const omittedCount = value.length - sanitizedEntries.length;

    if (omittedCount > 0) {
      sanitizedEntries.push({
        [TRUNCATED_ARRAY_META_KEY]: omittedCount,
      });
    }

    return sanitizedEntries;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    if (!isPlainObject(value)) {
      return sanitizeString(String(value));
    }

    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    const sanitizedObject = entries.reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : sanitizeValue(entryValue, depth + 1, seen);
      return acc;
    }, {});
    const omittedCount = Object.keys(value).length - entries.length;

    if (omittedCount > 0) {
      sanitizedObject[TRUNCATED_OBJECT_META_KEY] = omittedCount;
    }

    return sanitizedObject;
  }

  return sanitizeString(String(value));
}

function shouldLog(level: LogLevel): boolean {
  if (level === "debug" || level === "info") {
    return IS_DEV;
  }

  return true;
}

function emitLog(level: LogLevel, message: string, args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map((arg) => sanitizeValue(arg));

  switch (level) {
    case "debug":
      console.log(sanitizedMessage, ...sanitizedArgs);
      break;
    case "info":
      console.info(sanitizedMessage, ...sanitizedArgs);
      break;
    case "warn":
      console.warn(sanitizedMessage, ...sanitizedArgs);
      break;
    case "error":
      console.error(sanitizedMessage, ...sanitizedArgs);
      break;
  }
}

export function debugLog(message: string, ...args: unknown[]): void {
  emitLog("debug", message, args);
}

export function infoLog(message: string, ...args: unknown[]): void {
  emitLog("info", message, args);
}

export function warnLog(message: string, ...args: unknown[]): void {
  emitLog("warn", message, args);
}

export function errorLog(message: string, ...args: unknown[]): void {
  emitLog("error", message, args);
}

export function getErrorLogDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: sanitizeString(error.message),
    };

    const loggableError = error as Error & Record<string, unknown>;

    if (loggableError.code !== undefined) {
      details.code = sanitizeValue(loggableError.code);
    }

    if (loggableError.status !== undefined) {
      details.status = sanitizeValue(loggableError.status);
    }

    if (loggableError.statusText !== undefined) {
      details.statusText = sanitizeValue(loggableError.statusText);
    }

    if (loggableError.cause !== undefined) {
      details.cause = sanitizeValue(loggableError.cause);
    }

    if (IS_DEV && error.stack) {
      details.stack = sanitizeString(error.stack);
    }

    return details;
  }

  if (isPlainObject(error)) {
    return sanitizeValue(error) as Record<string, unknown>;
  }

  return {
    value: sanitizeValue(error),
  };
}

export function getHttpErrorLogDetails(
  status: number,
  statusText: string,
  bodyText?: string,
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    status,
    statusText: sanitizeString(statusText),
  };

  if (!bodyText) {
    return details;
  }

  const trimmedBody = bodyText.trim();

  if (!trimmedBody) {
    return details;
  }

  try {
    const parsedBody = JSON.parse(trimmedBody);

    if (isPlainObject(parsedBody)) {
      if (parsedBody.code !== undefined) {
        details.code = sanitizeValue(parsedBody.code);
      }

      if (parsedBody.message !== undefined) {
        details.message = sanitizeValue(parsedBody.message);
      }

      if (parsedBody.error !== undefined) {
        details.error = sanitizeValue(parsedBody.error);
      }

      if (parsedBody.error_description !== undefined) {
        details.errorDescription = sanitizeValue(
          parsedBody.error_description,
        );
      }

      return details;
    }
  } catch {
    // Plain text error bodies are handled below.
  }

  details.body = sanitizeString(trimmedBody);
  return details;
}
