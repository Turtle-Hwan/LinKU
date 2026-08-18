import type {
  Breadcrumb,
  ErrorEvent as SentryErrorEvent,
} from "@sentry/browser";
import {
  MONITORING_NORMALIZE_DEPTH,
  MONITORING_NORMALIZE_MAX_BREADTH,
} from "./constants.ts";
import {
  isSensitiveKey,
  redactSensitiveString,
  redactSensitiveUrl,
  REDACTED,
} from "./redaction.ts";

const TRUNCATED = "[Truncated]";
const CIRCULAR = "[Circular]";
const UNINSPECTABLE_OBJECT = "[Uninspectable Object]";
const UNINSPECTABLE_VALUE = "[Uninspectable Value]";
const TRUNCATED_ITEMS_KEY = "__truncated_items__";
const TRUNCATED_KEYS_KEY = "__truncated_keys__";

function readErrorString(
  error: Error,
  key: "name" | "message" | "stack",
): string | undefined {
  try {
    const value = error[key];
    return typeof value === "string"
      ? redactSensitiveString(value)
      : undefined;
  } catch {
    return UNINSPECTABLE_VALUE;
  }
}

function scrubError(
  error: Error,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  if (seen.has(error)) {
    return { value: CIRCULAR };
  }
  seen.add(error);

  const result: Record<string, unknown> = {
    name: readErrorString(error, "name") ?? "Error",
    message: readErrorString(error, "message") ?? "",
  };

  const stack = readErrorString(error, "stack");
  if (stack) {
    result.stack = stack;
  }

  if (depth >= MONITORING_NORMALIZE_DEPTH) {
    return result;
  }

  try {
    const keys = Object.keys(error);
    for (const key of keys.slice(0, MONITORING_NORMALIZE_MAX_BREADTH)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED;
        continue;
      }

      try {
        result[key] = scrubValue(
          (error as unknown as Record<string, unknown>)[key],
          depth + 1,
          seen,
        );
      } catch {
        result[key] = UNINSPECTABLE_VALUE;
      }
    }
    const omittedCount = keys.length - MONITORING_NORMALIZE_MAX_BREADTH;
    if (omittedCount > 0) {
      result[TRUNCATED_KEYS_KEY] = omittedCount;
    }
  } catch {
    result.details = UNINSPECTABLE_OBJECT;
  }

  return result;
}

export function scrubValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  try {
    return scrubValueUnsafe(value, depth, seen);
  } catch {
    return UNINSPECTABLE_OBJECT;
  }
}

function scrubValueUnsafe(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint" || typeof value === "symbol") {
    return String(value);
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Date) {
    try {
      return value.toISOString();
    } catch {
      return "[Invalid Date]";
    }
  }

  if (value instanceof URL) {
    return redactSensitiveUrl(value.toString());
  }

  if (value instanceof RegExp) {
    return redactSensitiveString(value.toString());
  }

  if (value instanceof Error) {
    return scrubError(value, depth, seen);
  }

  if (depth >= MONITORING_NORMALIZE_DEPTH) {
    return TRUNCATED;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);

    const result = value
      .slice(0, MONITORING_NORMALIZE_MAX_BREADTH)
      .map((item) => scrubValue(item, depth + 1, seen));
    const omittedCount = value.length - result.length;
    if (omittedCount > 0) {
      result.push({ [TRUNCATED_ITEMS_KEY]: omittedCount });
    }
    return result;
  }

  if (typeof value !== "object") {
    return redactSensitiveString(String(value));
  }

  if (seen.has(value)) {
    return CIRCULAR;
  }
  seen.add(value);

  try {
    const keys = Object.keys(value);
    const entries = keys
      .slice(0, MONITORING_NORMALIZE_MAX_BREADTH)
      .map((key): [string, unknown] => {
        if (isSensitiveKey(key)) {
          return [key, REDACTED];
        }

        let item: unknown;
        try {
          item = (value as Record<string, unknown>)[key];
        } catch {
          return [key, UNINSPECTABLE_VALUE];
        }

        return [
          key,
          /^(url|uri|href)$/i.test(key) && typeof item === "string"
            ? redactSensitiveUrl(item)
            : scrubValue(item, depth + 1, seen),
        ];
      });
    const omittedCount = keys.length - entries.length;
    if (omittedCount > 0) {
      entries.push([TRUNCATED_KEYS_KEY, omittedCount]);
    }
    return Object.fromEntries(entries);
  } catch {
    return UNINSPECTABLE_OBJECT;
  }
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message
      ? redactSensitiveString(breadcrumb.message)
      : breadcrumb.message,
    data: breadcrumb.data
      ? (scrubValue(breadcrumb.data) as Record<string, unknown>)
      : breadcrumb.data,
  };
}

export function scrubSentryEvent(event: SentryErrorEvent): SentryErrorEvent {
  const scrubbedEvent = { ...event };
  delete scrubbedEvent.user;

  if (event.request) {
    const request = { ...event.request };
    delete request.headers;
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    request.url = redactSensitiveUrl(request.url);
    scrubbedEvent.request = scrubValue(request) as typeof request;
  }

  if (event.tags) {
    scrubbedEvent.tags = scrubValue(event.tags) as Record<string, string>;
  }

  if (event.contexts) {
    scrubbedEvent.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }

  if (event.message) {
    scrubbedEvent.message = redactSensitiveString(event.message);
  }

  if (event.transaction) {
    scrubbedEvent.transaction = redactSensitiveString(event.transaction);
  }

  if (event.logentry) {
    scrubbedEvent.logentry = scrubValue(event.logentry) as typeof event.logentry;
  }

  if (event.fingerprint) {
    scrubbedEvent.fingerprint = event.fingerprint.map((value) =>
      redactSensitiveString(value),
    );
  }

  if (event.exception) {
    scrubbedEvent.exception = scrubValue(
      event.exception,
    ) as typeof event.exception;
  }

  if (event.extra) {
    scrubbedEvent.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  if (event.breadcrumbs) {
    scrubbedEvent.breadcrumbs = event.breadcrumbs.map(scrubSentryBreadcrumb);
  }

  if (event.threads) {
    scrubbedEvent.threads = scrubValue(event.threads) as typeof event.threads;
  }

  if (event.spans) {
    scrubbedEvent.spans = scrubValue(event.spans) as typeof event.spans;
  }

  return scrubbedEvent;
}
