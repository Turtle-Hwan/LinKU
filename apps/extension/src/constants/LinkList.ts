import { HelloLmsPng } from "@/assets";
import { executeScript, getCurrentTab, updateTabUrl } from "@/utils/chrome";
import {
  sugangRefreshBtn,
  수강시뮬Btn,
  취득학점확인원Btn,
} from "@/utils/sugang";
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
  MessageCircleMore,
  LucideIcon,
} from "lucide-react";

export interface SameHost {
  content: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export interface LinkListElement {
  icon: LucideIcon | string;
  label: string;
  link: string;
  samehost?: SameHost;
  samehost2?: SameHost;
  islong?: boolean;
  iconColor?: string;
  type?: "png" | "svg";
}

export const LinkList: LinkListElement[] = [
  // row1
  {
    icon: University,
    label: "홈페이지",
    link: "https://www.konkuk.ac.kr/konkuk/index.do",
    samehost: {
      content: "상용 SW 무료 대여",
      onClick: () => {
        updateTabUrl("https://www.konkuk.ac.kr/kuinc/15905/subview.do");
      },
    },
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

  // row2
  {
    icon: Trophy,
    label: "위인전",
    link: "https://wein.konkuk.ac.kr",
    samehost: {
      content: "K-Cube 대여",
      onClick: () => {
        updateTabUrl(
          "https://wein.konkuk.ac.kr/ptfol/cmnt/cube/findCubeResveStep1.do"
        );
      },
    },
  },

  {
    icon: Clock,
    label: "수강신청",
    link: "https://sugang.konkuk.ac.kr",
    samehost: {
      content: "수강인원 새로고침",
      onClick: () => {
        getCurrentTab().then((tab) => {
          executeScript(tab?.id ?? 0, sugangRefreshBtn);
        });
      },
    },
    samehost2: {
      content: "추가 신청서",
      onClick: () =>
        window.open(
          "https://www.konkuk.ac.kr/konkuk/2088/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGa29ua3VrJTJGMjQ3JTJGOTM0OTIyJTJGYXJ0Y2xWaWV3LmRvJTNGcGFnZSUzRDElMjZzcmNoQ29sdW1uJTNEc2olMjZzcmNoV3JkJTNEJUVDJUI0JTg4JUVBJUIzJUJDKyVFQSVCNSU5MCVFQSVCMyVCQyVFQiVBQSVBOSslRUMlQjYlOTQlRUElQjAlODAlMjZiYnNDbFNlcSUzRDEzOTQlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2"
        ),
    },
  },
  {
    icon: MapPinned,
    label: "캠퍼스맵",
    link: "https://research.konkuk.ac.kr/campusMap/konkuk/view.do#this",
    samehost: {
      content: "종강 == 법학관",
    },
  },

  // row3
  {
    icon: GraduationCap,
    label: "학사정보시스템",
    link: "https://kuis.konkuk.ac.kr/index.do",
    islong: true,
    samehost: {
      content: "취득학점확인원",
      onClick: () => {
        getCurrentTab().then((tab) => {
          executeScript(tab?.id ?? 0, 취득학점확인원Btn);
        });
      },
    },
    samehost2: {
      content: "수강시뮬레이션",
      onClick: () => {
        getCurrentTab().then((tab) => {
          executeScript(tab?.id ?? 0, 수강시뮬Btn);
        });
      },
    },
  },
  {
    icon: BookCopy,
    label: "상허기념도서관",
    link: "https://library.konkuk.ac.kr/",
    islong: true,
  },

  // row4
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
    icon: AlarmClock,
    iconColor: "text-red-600",
    label: "에브리타임",
    link: "https://account.everytime.kr/login",
  },

  // row5
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

  // row6
  {
    icon: ScrollText,
    label: "2025 요람",
    link: "https://www.konkuk.ac.kr/sites/bulletins25/index.do",
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
