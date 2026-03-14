import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

export function parseWorkspaceState(rawValue?: string | null): LinkuWorkspaceState {
  if (!rawValue) {
    return cloneDefaultState();
  }

  try {
    return normalizeState(JSON.parse(rawValue));
  } catch {
    return cloneDefaultState();
  }
}

export async function readWorkspaceState(): Promise<LinkuWorkspaceState> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;

  return parseWorkspaceState(rawValue);
}

export function createWorkspaceCookieResponse<TPayload>(
  state: LinkuWorkspaceState,
  payload: TPayload,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);

  response.cookies.set(WORKSPACE_COOKIE_NAME, JSON.stringify(state), {
    httpOnly: true,
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
