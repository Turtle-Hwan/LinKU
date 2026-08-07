/**
 * Banners Integration API
 * Fetch banners from GitHub Pages
 */

import { IMAGE_URL } from '@/constants/URL';
import { DEFAULT_SITE_URL } from '@linku/config';
import { WORKSPACE_BANNERS } from '@linku/platform';

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
  if (IMAGE_URL.startsWith(DEFAULT_SITE_URL)) {
    return { banners: [...WORKSPACE_BANNERS] };
  }

  try {
    const response = await fetch(`${IMAGE_URL}banners/banner.json`);

    if (!response.ok) {
      throw new Error(`Banner fetch failed: ${response.status}`);
    }

    return (await response.json()) as BannersResponseType;
  } catch {
    return { banners: [...WORKSPACE_BANNERS] };
  }
};
