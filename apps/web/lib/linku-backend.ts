import "server-only";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { readBackendEnv, readSiteEnv } from "@linku/config";

const LINKU_BACKEND_COOKIE = "linku_backend_session";
const LINKU_BACKEND_RETURN_TO_COOKIE = "linku_backend_return_to";
const LINKU_BACKEND_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type LinkuBackendMode = "guest" | "member";

export interface LinkuBackendSession {
  accessToken: string;
  refreshToken?: string;
  mode: LinkuBackendMode;
  kuMail?: string;
  connectedAt: string;
}

export interface LinkuBackendSnapshot {
  configured: boolean;
  connected: boolean;
  mode: "disconnected" | LinkuBackendMode;
  kuMail?: string;
  connectedAt?: string;
}

type LinkuBackendSuccess<T> = {
  ok: true;
  status: number;
  data: T;
  raw: unknown;
};

type LinkuBackendFailure = {
  ok: false;
  status: number;
  message: string;
  raw?: unknown;
};

export type LinkuBackendResult<T> =
  | LinkuBackendSuccess<T>
  | LinkuBackendFailure;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLinkuBackendSession(value: unknown): value is LinkuBackendSession {
  return (
    typeof value === "object" &&
    value !== null &&
    isNonEmptyString((value as LinkuBackendSession).accessToken) &&
    ((value as LinkuBackendSession).mode === "guest" ||
      (value as LinkuBackendSession).mode === "member") &&
    isNonEmptyString((value as LinkuBackendSession).connectedAt)
  );
}

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getBackendAppBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    maxAge: LINKU_BACKEND_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

function shouldUseRequestOrigin(siteUrl: string) {
  return (
    !siteUrl.startsWith("http://") &&
    !siteUrl.startsWith("https://")
  ) || siteUrl.includes("linku.xxx");
}

function createFailure(status: number, message: string, raw?: unknown): LinkuBackendFailure {
  return {
    ok: false,
    status,
    message,
    raw,
  };
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export function getLinkuBackendRuntime() {
  const apiBaseUrl = normalizeApiBaseUrl(readBackendEnv(process.env).apiBaseUrl);

  return {
    configured: apiBaseUrl.length > 0,
    apiBaseUrl,
    appBaseUrl: apiBaseUrl.length > 0 ? getBackendAppBaseUrl(apiBaseUrl) : "",
  };
}

export function sanitizeLinkuReturnTo(value: string | null | undefined) {
  if (isNonEmptyString(value) && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/account";
}

export function buildLinkuCallbackUrl(request: NextRequest) {
  const { siteUrl } = readSiteEnv(process.env);
  const origin = shouldUseRequestOrigin(siteUrl) ? request.nextUrl.origin : siteUrl;
  return new URL("/api/linku-auth/callback", origin).toString();
}

export async function readLinkuBackendSession() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(LINKU_BACKEND_COOKIE)?.value;

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isLinkuBackendSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getLinkuBackendSnapshot(): Promise<LinkuBackendSnapshot> {
  const runtime = getLinkuBackendRuntime();
  const session = await readLinkuBackendSession();

  return {
    configured: runtime.configured,
    connected: session !== null,
    mode: session?.mode || "disconnected",
    kuMail: session?.kuMail,
    connectedAt: session?.connectedAt,
  };
}

export async function readPendingLinkuReturnTo() {
  const cookieStore = await cookies();
  return sanitizeLinkuReturnTo(
    cookieStore.get(LINKU_BACKEND_RETURN_TO_COOKIE)?.value,
  );
}

function applyLinkuBackendSession(
  response: NextResponse,
  session: LinkuBackendSession | null,
) {
  if (session) {
    response.cookies.set(
      LINKU_BACKEND_COOKIE,
      JSON.stringify(session),
      getCookieOptions(),
    );
    return;
  }

  response.cookies.delete(LINKU_BACKEND_COOKIE);
}

export function setPendingLinkuReturnTo(
  response: NextResponse,
  returnTo: string,
) {
  response.cookies.set(
    LINKU_BACKEND_RETURN_TO_COOKIE,
    sanitizeLinkuReturnTo(returnTo),
    getCookieOptions(),
  );
}

export function clearPendingLinkuReturnTo(response: NextResponse) {
  response.cookies.delete(LINKU_BACKEND_RETURN_TO_COOKIE);
}

export function createLinkuBackendJsonResponse<TPayload>(
  payload: TPayload,
  session: LinkuBackendSession | null,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);
  applyLinkuBackendSession(response, session);
  return response;
}

export function createLinkuBackendRedirectResponse(
  url: string | URL,
  session: LinkuBackendSession | null,
) {
  const response = NextResponse.redirect(url);
  applyLinkuBackendSession(response, session);
  return response;
}

export async function requestLinkuBackend<TPayload>(
  path: string,
  init: RequestInit & {
    session?: LinkuBackendSession | null;
  } = {},
): Promise<LinkuBackendResult<TPayload>> {
  const runtime = getLinkuBackendRuntime();

  if (!runtime.configured) {
    return createFailure(503, "LinKU backend is not configured.");
  }

  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${runtime.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init.session?.accessToken) {
      headers.set("Authorization", `Bearer ${init.session.accessToken}`);
    }

    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });

    const raw = await parseResponseBody(response);

    if (typeof raw === "object" && raw !== null && "code" in raw) {
      const backendBody = raw as Record<string, unknown>;
      const message =
        typeof backendBody.message === "string"
          ? backendBody.message
          : `LinKU backend request failed (${response.status}).`;
      const code = backendBody.code;
      const successCode =
        code === 1000 || code === "1000" || code === 0 || code === "0";

      if (response.ok && successCode) {
        return {
          ok: true,
          status: response.status,
          data: ("result" in backendBody
            ? backendBody.result
            : raw) as TPayload,
          raw,
        };
      }

      return createFailure(response.status, message, raw);
    }

    if (!response.ok) {
      return createFailure(
        response.status,
        typeof raw === "string"
          ? raw
          : `LinKU backend request failed (${response.status}).`,
        raw,
      );
    }

    return {
      ok: true,
      status: response.status,
      data: raw as TPayload,
      raw,
    };
  } catch (error) {
    return createFailure(
      500,
      error instanceof Error
        ? error.message
        : "Failed to reach the LinKU backend.",
      error,
    );
  }
}
