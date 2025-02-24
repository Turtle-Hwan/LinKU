import {
  Search,
  Settings,
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { GitHubSvg, HelloLmsPng, LinkuLogoSvg } from "@/assets";
import React from "react";
import ImageCarousel from "./ImageCarousel";

const LinkList = [
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
    icon: UsersRound,
    label: "학과 정보",
    link: "https://www.konkuk.ac.kr/konkuk/2143/subview.do",
  },
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
];

const LinkList_long = [
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

const LinkGroup = () => {
  // const [nowLink, setNowLink] = React.useState<string>("");
  console.log(window.history);

  return (
    <div className="w-[500px] h-[600px] bg-white overflow-hidden">
      <LinkGroup.Header />
      <LinkGroup.Grid />
      <LinkGroup.Banner />
      <LinkGroup.Footer />
    </div>
  );
};

const Header = () => {
  return (
    <header className="p-4 border-b">
      <div className="flex items-center justify-between gap-4">
        <LinkuLogoSvg />
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="검색어 입력"
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Settings className="w-5 h-5 text-gray-600 cursor-pointer" />
          <GitHubSvg
            className="w-5 h-5 text-gray-600 cursor-pointer"
            onClick={() => {
              window.open("https://github.com/Turtle-Hwan/LinKU");
            }}
          />
        </div>
      </div>
    </header>
  );
};

const Grid = () => {
  return (
    <div className="Link__Grid grid grid-cols-6 gap-4 p-4">
      {LinkList.map((item, idx) => {
        return (
          <>
            {idx === 6 &&
              LinkList_long.map((item, idx) => (
                <button
                  key={idx}
                  className="col-span-3 flex flex-row items-center justify-start p-4 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer"
                  onClick={() => {
                    window.open(item.link);
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-[#00913A]/10 flex items-center justify-center shrink-0">
                    <item.icon
                      className={`Icon__Animation w-5 h-5 text-[#00913A]`}
                    />
                  </div>
                  <span className="w-full text-base text-black text-center break-keep">
                    {item.label}
                  </span>
                </button>
              ))}
            <LinkGroup.GridItem key={idx} item={item} />
          </>
        );
      })}
    </div>
  );
};

const GridItem = ({ item }) => {
  return (
    <button
      className="col-span-2 flex flex-row items-center justify-start p-4 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer"
      onClick={() => {
        window.open(item.link);
      }}
    >
      <div className="w-9 h-9 rounded-full bg-[#00913A]/10 flex items-center justify-center shrink-0">
        {item.type === "png" ? (
          <img
            src={item.icon}
            alt={item.label}
            className="Icon__Animation w-5 h-5 text-[#00913A]"
          />
        ) : (
          <item.icon className={`Icon__Animation w-5 h-5 text-[#00913A]`} />
        )}
      </div>
      <span className="w-full text-base text-black text-center break-keep">
        {item.label}
      </span>
    </button>
  );
};

const Banner = () => {
  return (
    <div className="mt-auto group">
      <ImageCarousel />
    </div>
  );
};

const Footer = () => {
  return <></>;
};

LinkGroup.Header = React.memo(Header);
LinkGroup.Grid = React.memo(Grid);
LinkGroup.GridItem = React.memo(GridItem);
LinkGroup.Banner = React.memo(Banner);
LinkGroup.Footer = React.memo(Footer);

export default React.memo(LinkGroup);
