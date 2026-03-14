import {
  APP_NAV_LINKS,
  AUTH_ROUTE_PATHS,
  FAQ_ITEMS,
  FEATURES,
  GUIDES,
  PUBLIC_ROUTE_PATHS,
  SERVICES,
  UPDATE_ENTRIES,
} from "@linku/core";
import { readSiteEnv } from "@linku/config";

export const siteEnv = readSiteEnv(process.env);

export const featureMap = new Map(FEATURES.map((item) => [item.slug, item]));
export const serviceMap = new Map(SERVICES.map((item) => [item.slug, item]));
export const guideMap = new Map(GUIDES.map((item) => [item.slug, item]));

export const faqItems = FAQ_ITEMS;
export const updateEntries = UPDATE_ENTRIES;
export const publicRoutePaths = PUBLIC_ROUTE_PATHS;
export const authRoutePaths = AUTH_ROUTE_PATHS;
export const appNavLinks = APP_NAV_LINKS;
