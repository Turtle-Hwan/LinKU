export interface WorkspaceBanner {
  img: string;
  alt: string;
  link: string;
}

export const WORKSPACE_BANNER_ASSET_BASE_URL =
  "https://turtle-hwan.github.io/LinKU/banners";

export const WORKSPACE_BANNERS: readonly WorkspaceBanner[] = [
  {
    img: "giveme_banner.png",
    link: "https://github.com/Turtle-Hwan/LinKU",
    alt: "LinKU GitHub",
  },
  {
    img: "mogakco.png",
    link: "https://open.kakao.com/o/gkPwoXDf",
    alt: "모각코 커뮤니티",
  },
  {
    img: "whenwillmeet_banner.png",
    link: "https://when-will-we-meet.com/",
    alt: "When will we meet",
  },
] as const;
