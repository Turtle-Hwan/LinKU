import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createWorkspaceCookieResponse, readWorkspaceState } from "@/lib/workspace-store";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const state = await readWorkspaceState();
  return NextResponse.json(state.extension);
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const body = (await request.json()) as {
    connected?: boolean;
    extensionId?: string;
  };
  const state = await readWorkspaceState();

  const nextState = {
    ...state,
    extension: {
      connected: Boolean(body.connected),
      extensionId: body.extensionId?.trim() || undefined,
      lastCheckedAt: new Date().toISOString(),
    },
  };

  return createWorkspaceCookieResponse(nextState, nextState.extension);
}
