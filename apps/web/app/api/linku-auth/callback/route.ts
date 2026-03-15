import { NextRequest } from "next/server";
import {
  buildLinkuCallbackUrl,
  clearPendingLinkuReturnTo,
  createLinkuBackendRedirectResponse,
  getLinkuBackendRuntime,
  readPendingLinkuReturnTo,
  requestLinkuBackend,
} from "@/lib/linku-backend";

interface LinkuOAuthLoginResult {
  accessToken?: string;
  refreshToken?: string | null;
}

export async function GET(request: NextRequest) {
  const runtime = getLinkuBackendRuntime();
  const returnTo = await readPendingLinkuReturnTo();
  const redirectTarget = new URL(returnTo, request.nextUrl.origin);
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (!runtime.configured) {
    redirectTarget.searchParams.set("linkuStatus", "missing-config");
    const response = createLinkuBackendRedirectResponse(redirectTarget, null);
    clearPendingLinkuReturnTo(response);
    return response;
  }

  if (error) {
    redirectTarget.searchParams.set("linkuStatus", "oauth-error");
    const response = createLinkuBackendRedirectResponse(redirectTarget, null);
    clearPendingLinkuReturnTo(response);
    return response;
  }

  if (!code) {
    redirectTarget.searchParams.set("linkuStatus", "missing-code");
    const response = createLinkuBackendRedirectResponse(redirectTarget, null);
    clearPendingLinkuReturnTo(response);
    return response;
  }

  const tokenExchangeUrl = new URL(`${runtime.appBaseUrl}/api/oauth2/google/login`);
  tokenExchangeUrl.searchParams.set("redirectUri", buildLinkuCallbackUrl(request));
  tokenExchangeUrl.searchParams.set("code", code);

  const result = await requestLinkuBackend<LinkuOAuthLoginResult>(
    tokenExchangeUrl.toString(),
    {
      method: "GET",
    },
  );

  if (!result.ok || !result.data.accessToken) {
    redirectTarget.searchParams.set("linkuStatus", "connect-failed");
    const response = createLinkuBackendRedirectResponse(redirectTarget, null);
    clearPendingLinkuReturnTo(response);
    return response;
  }

  const session = {
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken || undefined,
    mode: result.data.refreshToken ? "member" : "guest",
    connectedAt: new Date().toISOString(),
  } as const;

  redirectTarget.searchParams.set(
    "linkuStatus",
    session.mode === "guest" ? "guest-connected" : "connected",
  );
  const response = createLinkuBackendRedirectResponse(redirectTarget, session);
  clearPendingLinkuReturnTo(response);
  return response;
}
