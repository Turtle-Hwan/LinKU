import type { RSSAlertCategory } from "@linku/shared-types";

export interface KonkukAlertFeed {
  category: RSSAlertCategory;
  url: string;
}

export const KONKUK_ALERT_RSS_FEEDS: readonly KonkukAlertFeed[] = [
  {
    category: "학사",
    url: "https://www.konkuk.ac.kr/bbs/konkuk/234/rssList.do?row=50",
  },
  {
    category: "장학",
    url: "https://www.konkuk.ac.kr/bbs/konkuk/235/rssList.do?row=50",
  },
  {
    category: "국제",
    url: "https://www.konkuk.ac.kr/bbs/konkuk/237/rssList.do?row=50",
  },
  {
    category: "학생",
    url: "https://www.konkuk.ac.kr/bbs/konkuk/238/rssList.do?row=50",
  },
  {
    category: "일반",
    url: "https://www.konkuk.ac.kr/bbs/konkuk/240/rssList.do?row=50",
  },
];

export const KONKUK_CAREER_ALERT_URL =
  "https://www.konkuk.ac.kr/combBbs/konkuk/2/list.do";
