export const REDACTED = "[REDACTED]";
export const REDACTED_EMAIL = "[REDACTED_EMAIL]";

const SENSITIVE_KEY_PATTERN =
  /access.?token|refresh.?token|guest.?token|id.?token|authorization|cookie|password|secret|api.?key|email|session|user.?id|student.?id|student.?number|phone|display.?name|full.?name/i;
const SENSITIVE_QUERY_KEY_PATTERN =
  /^(access_token|refresh_token|guest_token|id_token|authorization|code|state|session|token|key|email|user_email|student_email|user_id|student_id|student_number|phone)$/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[^\s]+/gi;
const SENSITIVE_VALUE_PATTERN =
  /((?:["']?)(?:access[_-]?token|refresh[_-]?token|guest[_-]?token|id[_-]?token|authorization|cookie|password|secret|api[_-]?key|token|code|state|session|email|phone|user[_-]?id|student[_-]?(?:id|number)|display[_-]?name|full[_-]?name)(?:["']?\s*[:=]\s*))(["']?)[^"'&,\s}\]]+/gi;
const QUERY_VALUE_PATTERN =
  /([?&#](?:access_token|refresh_token|guest_token|id_token|authorization|code|state|session|token|key|email|user_email|student_email|user_id|student_id|student_number|phone)=)[^&#\s]*/gi;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactSensitiveString(
  value: string,
  maxLength?: number,
): string {
  const redacted = value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(SENSITIVE_VALUE_PATTERN, `$1$2${REDACTED}`)
    .replace(QUERY_VALUE_PATTERN, `$1${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL);

  if (maxLength === undefined || redacted.length <= maxLength) {
    return redacted;
  }

  return `${redacted.slice(0, maxLength)}...`;
}

export function redactSensitiveUrl(value?: string): string | undefined {
  if (!value) {
    return value;
  }

  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }
    return redactSensitiveString(url.toString());
  } catch {
    return "[REDACTED_URL]";
  }
}
