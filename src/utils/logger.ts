/**
 * 개발 환경 여부 — debug/info 로그 출력 기준
 *
 * ## 왜 import.meta.env.DEV를 쓰지 않는가
 *
 * Vite의 `import.meta.env.DEV`는 실행 **명령(command)** 을 기준으로 결정된다.
 * - `vite` (dev server 실행) → DEV = true
 * - `vite build`            → DEV = false  ← --mode development를 붙여도 마찬가지
 *
 * Vite는 빌드 시 `import.meta.env.*`를 정적 문자열로 치환(static replace)하는데,
 * DEV/PROD의 치환 기준이 mode가 아닌 command이기 때문에 build 산출물에서는
 * 항상 false가 된다.
 *
 * 결과적으로 `pnpm run build:local` (--mode development) 로 빌드한
 * 확장 프로그램에서 debugLog/infoLog가 전부 묵음이 되는 버그가 발생한다.
 *
 * ## 왜 import.meta.env.MODE를 쓰는가
 *
 * `import.meta.env.MODE`는 `--mode` 플래그 값을 그대로 반영한다.
 * - `vite build --mode development` → MODE = "development"  ✓
 * - `vite build --mode production`  → MODE = "production"
 * - `vite build` (기본값)           → MODE = "production"
 *
 * 이를 통해 build:local 환경에서 debug 로그가 정상 출력된다.
 */
import { reportError } from "@/monitoring";
import type { MonitoringLevel } from "@/monitoring";
import { isIgnoredMonitoringError } from "@/monitoring/constants";
import {
  isSensitiveKey,
  redactSensitiveString,
  REDACTED,
} from "@/monitoring/redaction";

const IS_DEV = import.meta.env.MODE === 'development';

const MAX_STRING_LENGTH = 400;
const MAX_ARRAY_LENGTH = 20;
const MAX_OBJECT_KEYS = 20;
const MAX_DEPTH = 4;
const TRUNCATED_ARRAY_META_KEY = "__truncated_items__";
const TRUNCATED_OBJECT_META_KEY = "__truncated_keys__";
const ERROR_ACCESSING_PROPERTY = "[Error accessing property]";
const UNINSPECTABLE_OBJECT = "[Uninspectable Object]";

type LogLevel = "debug" | "info" | "warn" | "error";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function getObjectKeys(value: object, isPlain: boolean): string[] {
  try {
    return isPlain ? Object.keys(value) : Object.getOwnPropertyNames(value);
  } catch {
    return [];
  }
}

function getObjectTypeName(value: object): string | null {
  try {
    const typeName = value.constructor?.name;
    return typeName && typeName !== "Object" ? typeName : null;
  } catch {
    return null;
  }
}

function sanitizeString(value: string): string {
  return redactSensitiveString(value, MAX_STRING_LENGTH);
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

  if (value instanceof RegExp) {
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

    const plainObject = isPlainObject(value);

    // non-plain 객체(커스텀 클래스, chrome API 객체 등)는 isPlainObject를 통과 못 해
    // String() 변환 시 "[object Object]"가 되어 디버깅 불가.
    // Object.getOwnPropertyNames로 non-enumerable 포함 own property를 추출한다.
    // (예: chrome.runtime.lastError.message는 non-enumerable이라 Object.keys에 안 잡힘)
    const allKeys = getObjectKeys(value as object, plainObject);

    const keys = allKeys.slice(0, MAX_OBJECT_KEYS);
    const sanitizedObject = keys.reduce<Record<string, unknown>>((acc, key) => {
      if (isSensitiveKey(key)) {
        acc[key] = REDACTED;
        return acc;
      }

      try {
        acc[key] = sanitizeValue(
          (value as Record<string, unknown>)[key],
          depth + 1,
          seen,
        );
      } catch {
        acc[key] = ERROR_ACCESSING_PROPERTY;
      }

      return acc;
    }, {});

    const omittedCount = allKeys.length - keys.length;
    if (omittedCount > 0) {
      sanitizedObject[TRUNCATED_OBJECT_META_KEY] = omittedCount;
    }

    // 클래스 인스턴스라면 타입 힌트 추가
    if (!plainObject) {
      const typeName = getObjectTypeName(value as object);
      if (typeName) {
        sanitizedObject["[type]"] = typeName;
      }
    }

    if (allKeys.length === 0 && Object.keys(sanitizedObject).length === 0) {
      return getObjectTypeName(value as object) ?? UNINSPECTABLE_OBJECT;
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

/** Explicit Sentry owner for an absorbed warning-level failure. */
export function captureWarnLog(message: string, ...args: unknown[]): void {
  emitLog("warn", message, args);
  reportHandledLog(
    message,
    args,
    "warning",
    "handled_warning",
    "logger.warn",
    captureWarnLog,
  );
}

type StackBoundary = (...args: never[]) => unknown;

function createHandledLogError(
  message: string,
  stackBoundary: StackBoundary,
): Error {
  const error = new Error(message);
  const errorConstructor = Error as ErrorConstructor & {
    captureStackTrace?: (target: object, boundary?: StackBoundary) => void;
  };
  errorConstructor.captureStackTrace?.(error, stackBoundary);
  return error;
}

function reportHandledLog(
  message: string,
  args: unknown[],
  level: MonitoringLevel,
  feature: string,
  mechanism: string,
  stackBoundary: StackBoundary,
): void {
  if (args.some(isIgnoredMonitoringError)) {
    return;
  }

  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map((arg) => sanitizeValue(arg));
  const originalError = args.find((arg): arg is Error => arg instanceof Error);

  reportError(originalError ?? createHandledLogError(sanitizedMessage, stackBoundary), {
    feature,
    category: `logger.${level === "warning" ? "warn" : "error"}`,
    breadcrumbMessage: sanitizedMessage,
    mechanism,
    handled: true,
    level,
    tags: { linku_log_level: level === "warning" ? "warn" : "error" },
    extras: {
      log_message: sanitizedMessage,
      log_args: sanitizedArgs,
    },
  });
}

export function errorLog(message: string, ...args: unknown[]): void {
  emitLog("error", message, args);
}

/** Explicit Sentry owner for an absorbed error-level failure. */
export function captureErrorLog(message: string, ...args: unknown[]): void {
  emitLog("error", message, args);
  reportHandledLog(
    message,
    args,
    "error",
    "handled_error",
    "logger.error",
    captureErrorLog,
  );
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
