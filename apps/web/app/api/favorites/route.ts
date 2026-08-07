import { NextResponse } from "next/server";
import { normalizeInternalAppPath } from "@linku/platform";
import { auth } from "@/auth";
import {
  createWorkspaceCookieResponse,
  getWorkspaceOwnerKey,
  readWorkspaceState,
  type FavoriteItem,
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
  return NextResponse.json(state.favorites);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const ownerKey = getWorkspaceOwnerKey(session);
  const body = (await request.json()) as Partial<FavoriteItem>;
  const title = body.title?.trim();
  const path = body.path ? normalizeInternalAppPath(body.path) : null;

  if (!title || !body.path?.trim()) {
    return NextResponse.json(
      { message: "api.errors.titleAndPathRequired" },
      { status: 400 },
    );
  }

  if (!path) {
    return NextResponse.json(
      { message: "api.errors.invalidInternalPath" },
      { status: 400 },
    );
  }

  const state = await readWorkspaceState(ownerKey);
  const nextFavorites = [
    {
      id: crypto.randomUUID(),
      title,
      path,
    },
    ...state.favorites.filter((item) => item.path !== path),
  ].slice(0, 12);

  const nextState = {
    ...state,
    favorites: nextFavorites,
  };

  return createWorkspaceCookieResponse(ownerKey, nextState, nextState.favorites);
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
      { message: "api.errors.favoriteIdRequired" },
      { status: 400 },
    );
  }

  const state = await readWorkspaceState(ownerKey);

  const nextState = {
    ...state,
    favorites: state.favorites.filter((item) => item.id !== body.id),
  };

  return createWorkspaceCookieResponse(ownerKey, nextState, nextState.favorites);
}
