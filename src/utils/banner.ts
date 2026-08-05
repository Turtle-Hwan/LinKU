import type { BannerItemType } from "@/apis/external/banners";

const TIMEZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;

const parseCampaignTime = (value: string | undefined) => {
  if (value === undefined) return undefined;
  if (!TIMEZONE_SUFFIX_PATTERN.test(value)) return null;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const isBannerActive = (
  banner: BannerItemType,
  currentTime = Date.now()
) => {
  const startAt = parseCampaignTime(banner.startAt);
  const endAt = parseCampaignTime(banner.endAt);

  if (startAt === null || endAt === null) return false;
  if (startAt !== undefined && currentTime < startAt) return false;
  if (endAt !== undefined && currentTime >= endAt) return false;

  return true;
};
