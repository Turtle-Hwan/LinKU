import { IMAGE_URL } from "@/constants/URL";

interface BannersResponseType {
  banners: BannerItemType[];
}

export interface BannerItemType {
  img: string;
  alt: string;
  link: string;
}

export const getBannersAPI = async () => {
  const response = await fetch(`${IMAGE_URL}banners/banner.json`);
  const data: BannersResponseType = await response.json();
  await new Promise((resolve) => {
    setTimeout(resolve, 1500);
  });
  return data;
};
