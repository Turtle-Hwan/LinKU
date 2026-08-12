import type { ApiErrorCode, ApiResult } from "../src/types/serverless";

export function json<T>(
  value: T,
  status = 200,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}

export function ok<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return json<ApiResult<T>>({ ok: true, data }, status, headers);
}

export function fail(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  status: number,
  retryable = false,
): Response {
  return json<ApiResult<never>>(
    { ok: false, error: { code, message, retryable, requestId } },
    status,
  );
}

export async function readJsonBody<T>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > maxBytes) throw new RangeError("PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RangeError("PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(text) as T;
}
