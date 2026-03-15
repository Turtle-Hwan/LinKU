import {
  APP_NAV_LINKS,
  AUTH_ROUTE_PATHS,
  FAQ_ITEMS,
  FEATURES,
  GUIDES,
  PUBLIC_ROUTE_PATHS,
  SERVICES,
  TOP_NAV_LINKS,
  UPDATE_ENTRIES,
  type LinkuAppNavItem,
  type LinkuFaqItem,
  type LinkuFeature,
  type LinkuGuide,
  type LinkuPageSummary,
  type LinkuService,
  type LinkuUpdateEntry,
} from "@linku/core";
import { readSiteEnv } from "@linku/config";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export const siteEnv = readSiteEnv(process.env);

export interface LocalizedPageSummary
  extends Omit<LinkuPageSummary, "titleKey" | "summaryKey"> {
  title: string;
  summary: string;
}

export interface LocalizedFeature
  extends Omit<LinkuFeature, "titleKey" | "summaryKey" | "highlightKeys"> {
  title: string;
  summary: string;
  highlights: string[];
}

export interface LocalizedService
  extends Omit<LinkuService, "titleKey" | "summaryKey" | "audienceKey" | "taskKeys"> {
  title: string;
  summary: string;
  audience: string;
  tasks: string[];
}

export interface LocalizedGuide
  extends Omit<LinkuGuide, "titleKey" | "summaryKey" | "stepKeys"> {
  title: string;
  summary: string;
  steps: string[];
}

export interface LocalizedFaqItem extends Omit<LinkuFaqItem, "questionKey" | "answerKey"> {
  question: string;
  answer: string;
}

export interface LocalizedUpdateEntry
  extends Omit<LinkuUpdateEntry, "titleKey" | "summaryKey" | "bulletKeys"> {
  title: string;
  summary: string;
  bullets: string[];
}

function translatePageSummary(
  item: LinkuPageSummary,
  t: TranslateFn,
): LocalizedPageSummary {
  return {
    slug: item.slug,
    path: item.path,
    title: t(item.titleKey),
    summary: t(item.summaryKey),
  };
}

export function translateFeatures(t: TranslateFn): LocalizedFeature[] {
  return FEATURES.map((feature) => ({
    slug: feature.slug,
    path: feature.path,
    title: t(feature.titleKey),
    summary: t(feature.summaryKey),
    highlights: feature.highlightKeys.map((key) => t(key)),
  }));
}

export function translateServices(t: TranslateFn): LocalizedService[] {
  return SERVICES.map((service) => ({
    slug: service.slug,
    path: service.path,
    title: t(service.titleKey),
    summary: t(service.summaryKey),
    audience: t(service.audienceKey),
    tasks: service.taskKeys.map((key) => t(key)),
  }));
}

export function translateGuides(t: TranslateFn): LocalizedGuide[] {
  return GUIDES.map((guide) => ({
    slug: guide.slug,
    path: guide.path,
    title: t(guide.titleKey),
    summary: t(guide.summaryKey),
    steps: guide.stepKeys.map((key) => t(key)),
  }));
}

export function translateFaqItems(t: TranslateFn): LocalizedFaqItem[] {
  return FAQ_ITEMS.map((item) => ({
    slug: item.slug,
    question: t(item.questionKey),
    answer: t(item.answerKey),
  }));
}

export function translateUpdateEntries(t: TranslateFn): LocalizedUpdateEntry[] {
  return UPDATE_ENTRIES.map((entry) => ({
    slug: entry.slug,
    publishedAt: entry.publishedAt,
    title: t(entry.titleKey),
    summary: t(entry.summaryKey),
    bullets: entry.bulletKeys.map((key) => t(key)),
  }));
}

export function translateTopNavLinks(t: TranslateFn): LocalizedPageSummary[] {
  return TOP_NAV_LINKS.map((item) => translatePageSummary(item, t));
}

export function translateAppNavLinks(t: TranslateFn): LocalizedPageSummary[] {
  return APP_NAV_LINKS.map((item: LinkuAppNavItem) => translatePageSummary(item, t));
}

export const featureMap = new Map(FEATURES.map((item) => [item.slug, item]));
export const serviceMap = new Map(SERVICES.map((item) => [item.slug, item]));
export const guideMap = new Map(GUIDES.map((item) => [item.slug, item]));

export const publicRoutePaths = PUBLIC_ROUTE_PATHS;
export const authRoutePaths = AUTH_ROUTE_PATHS;
