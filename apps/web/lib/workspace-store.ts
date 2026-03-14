import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { ExtensionConnectionState } from "@linku/shared-types";

export interface FavoriteItem {
  id: string;
  title: string;
  path: string;
}

export interface PersonalLinkItem {
  id: string;
  label: string;
  url: string;
}

export interface LinkuUserSettings {
  defaultLandingRoute: string;
  openLinksInNewTab: boolean;
  weeklyDigest: boolean;
}

export interface LinkuWorkspaceState {
  favorites: FavoriteItem[];
  links: PersonalLinkItem[];
  settings: LinkuUserSettings;
  extension: ExtensionConnectionState;
}

const WORKSPACE_COOKIE_NAME = "linku_workspace";
const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ANONYMOUS_WORKSPACE_OWNER = "anonymous-workspace";

const DEFAULT_WORKSPACE_STATE: LinkuWorkspaceState = {
  favorites: [],
  links: [],
  settings: {
    defaultLandingRoute: "/dashboard",
    openLinksInNewTab: true,
    weeklyDigest: false,
  },
  extension: {
    connected: false,
  },
};

function cloneDefaultState(): LinkuWorkspaceState {
  return structuredClone(DEFAULT_WORKSPACE_STATE);
}

function isFavoriteItem(value: unknown): value is FavoriteItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as FavoriteItem).id === "string" &&
    typeof (value as FavoriteItem).title === "string" &&
    typeof (value as FavoriteItem).path === "string"
  );
}

function isPersonalLinkItem(value: unknown): value is PersonalLinkItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PersonalLinkItem).id === "string" &&
    typeof (value as PersonalLinkItem).label === "string" &&
    typeof (value as PersonalLinkItem).url === "string"
  );
}

function normalizeExtensionState(value: unknown): ExtensionConnectionState {
  if (typeof value !== "object" || value === null) {
    return cloneDefaultState().extension;
  }

  const extension = value as ExtensionConnectionState;

  return {
    connected: Boolean(extension.connected),
    extensionId:
      typeof extension.extensionId === "string" ? extension.extensionId : undefined,
    lastCheckedAt:
      typeof extension.lastCheckedAt === "string" ? extension.lastCheckedAt : undefined,
  };
}

function normalizeSettings(value: unknown): LinkuUserSettings {
  if (typeof value !== "object" || value === null) {
    return cloneDefaultState().settings;
  }

  const settings = value as Partial<LinkuUserSettings>;

  return {
    defaultLandingRoute:
      typeof settings.defaultLandingRoute === "string"
        ? settings.defaultLandingRoute
        : DEFAULT_WORKSPACE_STATE.settings.defaultLandingRoute,
    openLinksInNewTab:
      typeof settings.openLinksInNewTab === "boolean"
        ? settings.openLinksInNewTab
        : DEFAULT_WORKSPACE_STATE.settings.openLinksInNewTab,
    weeklyDigest:
      typeof settings.weeklyDigest === "boolean"
        ? settings.weeklyDigest
        : DEFAULT_WORKSPACE_STATE.settings.weeklyDigest,
  };
}

function normalizeState(value: unknown): LinkuWorkspaceState {
  if (typeof value !== "object" || value === null) {
    return cloneDefaultState();
  }

  const state = value as Partial<LinkuWorkspaceState>;

  return {
    favorites: Array.isArray(state.favorites)
      ? state.favorites.filter(isFavoriteItem).slice(0, 12)
      : cloneDefaultState().favorites,
    links: Array.isArray(state.links)
      ? state.links.filter(isPersonalLinkItem).slice(0, 12)
      : cloneDefaultState().links,
    settings: normalizeSettings(state.settings),
    extension: normalizeExtensionState(state.extension),
  };
}

interface StoredWorkspaceState {
  ownerKey: string;
  state: LinkuWorkspaceState;
}

type WorkspaceSession = Pick<Session, "user"> | null | undefined;

function isStoredWorkspaceState(value: unknown): value is StoredWorkspaceState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredWorkspaceState).ownerKey === "string" &&
    "state" in value
  );
}

export function getWorkspaceOwnerKey(session: WorkspaceSession): string {
  const candidate = session?.user?.id ?? session?.user?.email;

  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : ANONYMOUS_WORKSPACE_OWNER;
}

export function parseWorkspaceState(
  rawValue: string | null | undefined,
  ownerKey: string,
): LinkuWorkspaceState {
  if (ownerKey === ANONYMOUS_WORKSPACE_OWNER) {
    return cloneDefaultState();
  }

  if (!rawValue) {
    return cloneDefaultState();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isStoredWorkspaceState(parsed)) {
      return cloneDefaultState();
    }

    if (parsed.ownerKey !== ownerKey) {
      return cloneDefaultState();
    }

    return normalizeState(parsed.state);
  } catch {
    return cloneDefaultState();
  }
}

export async function readWorkspaceState(ownerKey: string): Promise<LinkuWorkspaceState> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;

  return parseWorkspaceState(rawValue, ownerKey);
}

export function createWorkspaceCookieResponse<TPayload>(
  ownerKey: string,
  state: LinkuWorkspaceState,
  payload: TPayload,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);

  response.cookies.set(
    WORKSPACE_COOKIE_NAME,
    JSON.stringify({
      ownerKey,
      state,
    } satisfies StoredWorkspaceState),
    {
    httpOnly: true,
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    },
  );

  return response;
}

export async function clearWorkspaceState() {
  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_COOKIE_NAME);
}
