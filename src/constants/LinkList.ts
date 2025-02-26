import { HelloLmsPng } from "@/assets";
import {
  BellRing,
  University,
  CalendarDays,
  BookCopy,
  Clock,
  Trophy,
  GraduationCap,
  AlarmClock,
  MapPinned,
  Utensils,
  Building,
  ScrollText,
  UsersRound,
  Bed,
  Lightbulb,
} from "lucide-react";

export const LinkList = [
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
  { icon: Trophy, label: "위인전", link: "https://wein.konkuk.ac.kr" },

  { icon: Clock, label: "수강신청", link: "https://sugang.konkuk.ac.kr" },
  {
    icon: MapPinned,
    label: "캠퍼스맵",
    link: "https://research.konkuk.ac.kr/campusMap/konkuk/view.do#this",
  },

  {
    icon: CalendarDays,
    label: "학사일정",
    link: "https://korea.konkuk.ac.kr/konkuk/2161/subview.do",
  },
  {
    icon: Utensils,
    label: "학식 메뉴",
    link: "https://grad.konkuk.ac.kr/general/18211/subview.do",
  },
  {
    icon: AlarmClock,
    color: "#E01216",
    label: "에브리타임",
    link: "https://account.everytime.kr/login",
  },
  {
    icon: Bed,
    label: "쿨하우스",
    link: "https://kulhouse.konkuk.ac.kr",
  },
];

export const LinkList_col1 = [
  {
    icon: UsersRound,
    label: "학과 정보",
    link: "https://www.konkuk.ac.kr/konkuk/2143/subview.do",
  },
  {
    icon: ScrollText,
    label: "2025 요람",
    link: "https://grad.konkuk.ac.kr/sites/bulletins25/index.do",
  },
];

export const LinkList_col2 = [
  {
    icon: Building,
    label: "현장실습",
    link: "https://field.konkuk.ac.kr/index.do",
  },
  {
    icon: Lightbulb,
    label: "창업지원단",
    link: "https://startup.konkuk.ac.kr",
  },
];

export const LinkList_long = [
  {
    icon: GraduationCap,
    label: "학사정보시스템",
    link: "https://kuis.konkuk.ac.kr/index.do",
  },
  {
    icon: BookCopy,
    label: "상허기념도서관",
    link: "https://library.konkuk.ac.kr/",
  },
];
