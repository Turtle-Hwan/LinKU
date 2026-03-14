/**
 * Banners Integration API
 * Fetch banners from GitHub Pages
 */

import { IMAGE_URL } from '@/constants/URL';

/**
 * Banner item type
 */
export interface BannerItemType {
  img: string;
  alt: string;
  link: string;
}

/**
 * Banners response type
 */
interface BannersResponseType {
  banners: BannerItemType[];
}

/**
 * Fetch banners from GitHub Pages
 * @returns Banner list
 */
export const getBannersAPI = async (): Promise<BannersResponseType> => {
  const response = await fetch(`${IMAGE_URL}banners/banner.json`);
  const data: BannersResponseType = await response.json();
  return data;
};
