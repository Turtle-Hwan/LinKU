import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getLinkuBackendSnapshot,
  readLinkuBackendSession,
  requestLinkuBackend,
} from "@/lib/linku-backend";

interface TemplateProxyOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: FormData | URLSearchParams | string | Record<string, unknown> | unknown[];
  headers?: HeadersInit;
  requireWebSession?: boolean;
  requireBackendSession?: boolean;
}

function buildRequestBody(
  body: TemplateProxyOptions["body"],
  headers: Headers,
): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    typeof body === "string"
  ) {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

export async function proxyLinkuTemplateRequest<TPayload>(
  path: string,
  {
    method = "GET",
    body,
    headers,
    requireWebSession = true,
    requireBackendSession = true,
  }: TemplateProxyOptions = {},
) {
  const webSession = await auth();

  if (requireWebSession && !webSession) {
    return NextResponse.json(
      { message: "A signed-in LinKU web session is required." },
      { status: 401 },
    );
  }

  const snapshot = await getLinkuBackendSnapshot();

  if (!snapshot.configured) {
    return NextResponse.json(
      {
        message: "LINKU_API_BASE_URL is not configured.",
        snapshot,
      },
      { status: 503 },
    );
  }

  const backendSession = await readLinkuBackendSession();

  if (requireBackendSession && !backendSession) {
    return NextResponse.json(
      {
        message: "Connect the LinKU backend before using this feature.",
        snapshot,
      },
      { status: 401 },
    );
  }

  const requestHeaders = new Headers(headers);
  const requestBody = buildRequestBody(body, requestHeaders);

  const result = await requestLinkuBackend<TPayload>(path, {
    method,
    body: requestBody,
    headers: requestHeaders,
    session: backendSession,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.message,
        snapshot,
      },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json(result.data);
}
