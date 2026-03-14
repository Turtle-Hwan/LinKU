import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWorkspaceCookieResponse,
  readWorkspaceState,
  type FavoriteItem,
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
  return NextResponse.json(state.favorites);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<FavoriteItem>;
  const title = body.title?.trim();
  const path = body.path?.trim();

  if (!title || !path) {
    return NextResponse.json({ message: "Title and path are required." }, { status: 400 });
  }

  const state = await readWorkspaceState();
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

  return createWorkspaceCookieResponse(nextState, nextState.favorites);
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session) {
    return unauthorized();
  }

  const body = (await request.json()) as { id?: string };

  if (!body.id) {
    return NextResponse.json({ message: "Favorite id is required." }, { status: 400 });
  }

  const state = await readWorkspaceState();

  const nextState = {
    ...state,
    favorites: state.favorites.filter((item) => item.id !== body.id),
  };

  return createWorkspaceCookieResponse(nextState, nextState.favorites);
}
