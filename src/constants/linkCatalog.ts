import { HelloLmsPng } from "@/assets";
import EverytimeSymbolUrl from "@/assets/everytime_symbol.svg";
import {
  BULLETIN_FALLBACK,
  BULLETIN_LINK_ID,
} from "@/constants/bulletin";
import {
  Bed,
  BellRing,
  BookCopy,
  Building,
  CalendarDays,
  Clock,
  GraduationCap,
  Lightbulb,
  MapPinned,
  MessageCircleMore,
  ScrollText,
  Trophy,
  University,
  UsersRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/** Static link data safe to reuse in extension and no-network web runtimes. */
export interface LinkCatalogElement {
  id?: string;
  icon: LucideIcon | string;
  label: string;
  link: string;
  islong?: boolean;
  iconColor?: string;
  type?: "png" | "svg";
}

export const LINK_CATALOG: LinkCatalogElement[] = [
  {
    icon: University,
    label: "홈페이지",
    link: "https://www.konkuk.ac.kr/konkuk/index.do",
  },
  {
    icon: BellRing,
    label: "공지사항",
    link: "https://www.konkuk.ac.kr/konkuk/2238/subview.do",
  },
  {
    icon: HelloLmsPng,
    type: "png",
    label: "eCampus",
    link: "https://ecampus.konkuk.ac.kr",
  },
  {
    icon: Trophy,
    label: "위인전",
    link: "https://wein.konkuk.ac.kr",
  },
  {
    icon: Clock,
    label: "수강신청",
    link: "https://sugang.konkuk.ac.kr",
  },
  {
    icon: MapPinned,
    label: "캠퍼스맵",
    link: "https://research.konkuk.ac.kr/campusMap/konkuk/view.do#this",
  },
  {
    icon: GraduationCap,
    label: "학사정보시스템",
    link: "https://kuis.konkuk.ac.kr/index.do",
    islong: true,
  },
  {
    icon: BookCopy,
    label: "상허기념도서관",
    link: "https://library.konkuk.ac.kr/",
    islong: true,
  },
  {
    icon: CalendarDays,
    label: "학사일정",
    link: "https://www.konkuk.ac.kr/konkuk/2161/subview.do",
  },
  {
    icon: Utensils,
    label: "학식 메뉴",
    link: "https://www.konkuk.ac.kr/general/18211/subview.do",
  },
  {
    icon: EverytimeSymbolUrl,
    type: "svg",
    label: "에브리타임",
    link: "https://account.everytime.kr/login",
  },
  {
    icon: UsersRound,
    label: "학과 정보",
    link: "https://www.konkuk.ac.kr/konkuk/2143/subview.do",
  },
  {
    icon: Bed,
    label: "쿨하우스",
    link: "https://kulhouse.konkuk.ac.kr",
  },
  {
    icon: MessageCircleMore,
    label: "KUNG",
    link: "https://kung.kr/",
  },
  {
    id: BULLETIN_LINK_ID,
    icon: ScrollText,
    label: BULLETIN_FALLBACK.label,
    link: BULLETIN_FALLBACK.url,
  },
  {
    icon: Building,
    label: "현장실습",
    link: "https://field.konkuk.ac.kr/index.do",
  },
  {
    icon: Lightbulb,
    label: "창업지원",
    link: "https://startup.konkuk.ac.kr",
  },
];
