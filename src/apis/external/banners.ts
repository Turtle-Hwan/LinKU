/**
 * Banners Integration API
 * Fetch banners from GitHub Pages
 */

import { IMAGE_URL } from '../../constants/URL.ts';

export const BANNER_BASE_URL = new URL("banners/", IMAGE_URL).toString();
export const BANNER_JSON_URL = new URL(
  "banner.json",
  BANNER_BASE_URL,
).toString();

/**
 * Banner item type
 */
export interface BannerItemType {
  img: string;
  alt: string;
  link: string;
  startAt?: string;
  endAt?: string;
}

/**
 * Banners response type
 */
export interface BannersResponseType {
  banners: BannerItemType[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isOptionalString = (value: unknown) =>
  value === undefined || typeof value === "string";

const isBannerItem = (value: unknown): value is BannerItemType => {
  if (!isRecord(value)) return false;

  return (
    typeof value.img === "string" &&
    value.img.length > 0 &&
    typeof value.alt === "string" &&
    value.alt.length > 0 &&
    typeof value.link === "string" &&
    value.link.length > 0 &&
    isOptionalString(value.startAt) &&
    isOptionalString(value.endAt)
  );
};

export const parseBannersResponse = (
  value: unknown,
): BannersResponseType => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.banners) ||
    !value.banners.every(isBannerItem)
  ) {
    throw new Error("Invalid banner response");
  }

  return { banners: value.banners };
};

export const getBannerImageURL = (imagePath: string) => {
  const baseURL = new URL(BANNER_BASE_URL);
  const imageURL = new URL(imagePath, baseURL);

  if (
    imageURL.origin !== baseURL.origin ||
    !imageURL.pathname.startsWith(baseURL.pathname)
  ) {
    throw new Error("Invalid banner image path");
  }

  return imageURL.toString();
};

/**
 * Fetch banners from GitHub Pages
 * @returns Banner list
 */
export const getBannersAPI = async (): Promise<BannersResponseType> => {
  const response = await fetch(BANNER_JSON_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch banners: ${response.status}`);
  }

  const data: unknown = await response.json();
  return parseBannersResponse(data);
};
