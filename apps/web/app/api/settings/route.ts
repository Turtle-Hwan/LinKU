import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWorkspaceCookieResponse,
  readWorkspaceState,
  type LinkuUserSettings,
} from "@/lib/workspace-store";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const state = await readWorkspaceState();
  return NextResponse.json(state.settings);
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<LinkuUserSettings>;
  const state = await readWorkspaceState();

  const nextSettings: LinkuUserSettings = {
    defaultLandingRoute:
      typeof body.defaultLandingRoute === "string" && body.defaultLandingRoute.trim().length > 0
        ? body.defaultLandingRoute.trim()
        : state.settings.defaultLandingRoute,
    openLinksInNewTab:
      typeof body.openLinksInNewTab === "boolean"
        ? body.openLinksInNewTab
        : state.settings.openLinksInNewTab,
    weeklyDigest:
      typeof body.weeklyDigest === "boolean"
        ? body.weeklyDigest
        : state.settings.weeklyDigest,
  };

  const nextState = {
    ...state,
    settings: nextSettings,
  };

  return createWorkspaceCookieResponse(nextState, nextState.settings);
}
