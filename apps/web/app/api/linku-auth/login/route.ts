import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildLinkuCallbackUrl,
  getLinkuBackendRuntime,
  sanitizeLinkuReturnTo,
  setPendingLinkuReturnTo,
} from "@/lib/linku-backend";

export async function GET(request: NextRequest) {
  const session = await auth();
  const returnTo = sanitizeLinkuReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
  );

  if (!session) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  const runtime = getLinkuBackendRuntime();
  const redirectTarget = new URL(returnTo, request.nextUrl.origin);

  if (!runtime.configured) {
    redirectTarget.searchParams.set("linkuStatus", "missing-config");
    return NextResponse.redirect(redirectTarget);
  }

  const backendAuthUrl = new URL(`${runtime.appBaseUrl}/api/oauth2/google`);
  backendAuthUrl.searchParams.set(
    "redirectUri",
    buildLinkuCallbackUrl(request),
  );

  const response = NextResponse.redirect(backendAuthUrl);
  setPendingLinkuReturnTo(response, returnTo);
  return response;
}
