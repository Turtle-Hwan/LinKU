import { HelloLmsPng } from "@/assets";
import { executeScript, getCurrentTab, updateTabUrl } from "@/utils/chrome";
import { sugangRefreshBtn } from "@/utils/sugang";
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
} from "lucide-react";

export const LinkList = [
  {
    icon: University,
    label: "홈페이지",
    link: "https://www.konkuk.ac.kr/konkuk/index.do",
    samehost: {
      content: "상용 SW 무료 대여",
      onClick: () => {
        updateTabUrl("https://grad.konkuk.ac.kr/kuinc/15905/subview.do");
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

  //
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
          executeScript(tab.id ?? 0, sugangRefreshBtn);
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

  //
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

  //
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

  //
  {
    icon: ScrollText,
    label: "2025 요람",
    link: "https://grad.konkuk.ac.kr/sites/bulletins25/index.do",
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
