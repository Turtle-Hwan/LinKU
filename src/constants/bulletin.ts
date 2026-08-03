export interface BulletinInfo {
  year: number;
  label: string;
  url: string;
}

export const BULLETIN_FALLBACK_YEAR = 2026;
export const BULLETIN_LINK_ID = "official-bulletin";

export function createBulletinInfo(year: number): BulletinInfo {
  const shortYear = String(year).slice(-2);

  return {
    year,
    label: `${year} 요람`,
    url: `https://www.konkuk.ac.kr/bulletins${shortYear}/index.do`,
  };
}

export const BULLETIN_FALLBACK = createBulletinInfo(
  BULLETIN_FALLBACK_YEAR,
);
