import type { BannerItemType } from "@/apis/external/banners";

const TIMEZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T/i;
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const hasValidCalendarDate = (value: string) => {
  const match = ISO_DATE_PREFIX_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;

  const daysInMonth =
    month === 2 && isLeapYear(year) ? 29 : DAYS_PER_MONTH[month - 1];
  return day >= 1 && day <= daysInMonth;
};

const parseCampaignTime = (value: string | undefined) => {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !TIMEZONE_SUFFIX_PATTERN.test(value) ||
    !hasValidCalendarDate(value)
  ) {
    return null;
  }

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
