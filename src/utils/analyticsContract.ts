export type GAEventParam = string | number | boolean;

export interface GAEvent {
  name: string;
  params: Record<string, GAEventParam>;
}

export interface AnalyticsPayload {
  client_id: string;
  events: GAEvent[];
}

const MAX_EVENTS_PER_REQUEST = 25;
const MAX_EVENT_PARAMS = 25;
const MAX_CLIENT_ID_LENGTH = 128;
const MAX_PARAM_VALUE_LENGTH = 4096;
const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/u;
const PARAM_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/u;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isGAEventParam(value: unknown): value is GAEventParam {
  if (typeof value === "string") {
    return value.length <= MAX_PARAM_VALUE_LENGTH;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "boolean";
}

function isGAEvent(value: unknown): value is GAEvent {
  if (!isPlainRecord(value)) return false;
  if (typeof value.name !== "string" || !EVENT_NAME_PATTERN.test(value.name)) {
    return false;
  }
  if (!isPlainRecord(value.params)) return false;

  const params = Object.entries(value.params);
  return (
    params.length <= MAX_EVENT_PARAMS &&
    params.every(
      ([name, param]) =>
        PARAM_NAME_PATTERN.test(name) && isGAEventParam(param),
    )
  );
}

export function isAnalyticsPayload(value: unknown): value is AnalyticsPayload {
  if (!isPlainRecord(value)) return false;
  if (
    typeof value.client_id !== "string" ||
    value.client_id.length === 0 ||
    value.client_id.length > MAX_CLIENT_ID_LENGTH
  ) {
    return false;
  }
  if (!Array.isArray(value.events)) return false;

  return (
    value.events.length > 0 &&
    value.events.length <= MAX_EVENTS_PER_REQUEST &&
    value.events.every(isGAEvent)
  );
}
