import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWorkspaceCookieResponse,
  getWorkspaceOwnerKey,
  readWorkspaceState,
  type PersonalLinkItem,
} from "@/lib/workspace-store";

function unauthorized() {
  return NextResponse.json({ message: "api.errors.unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const ownerKey = getWorkspaceOwnerKey(session);
  const state = await readWorkspaceState(ownerKey);
  return NextResponse.json(state.links);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const ownerKey = getWorkspaceOwnerKey(session);
  const body = (await request.json()) as Partial<PersonalLinkItem>;
  const label = body.label?.trim();
  const url = body.url?.trim();

  if (!label || !url) {
    return NextResponse.json(
      { message: "api.errors.labelAndUrlRequired" },
      { status: 400 },
    );
  }

  const state = await readWorkspaceState(ownerKey);
  const nextLinks = [
    {
      id: crypto.randomUUID(),
      label,
      url,
    },
    ...state.links.filter((item) => item.url !== url),
  ].slice(0, 12);

  const nextState = {
    ...state,
    links: nextLinks,
  };

  return createWorkspaceCookieResponse(ownerKey, nextState, nextState.links);
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const ownerKey = getWorkspaceOwnerKey(session);
  const body = (await request.json()) as { id?: string };

  if (!body.id) {
    return NextResponse.json(
      { message: "api.errors.linkIdRequired" },
      { status: 400 },
    );
  }

  const state = await readWorkspaceState(ownerKey);

  const nextState = {
    ...state,
    links: state.links.filter((item) => item.id !== body.id),
  };

  return createWorkspaceCookieResponse(ownerKey, nextState, nextState.links);
}
