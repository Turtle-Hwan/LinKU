import {
  Search,
  Settings,
  BellRing,
  Home,
  CalendarDays,
  BookCopy,
  Clock,
  Trophy,
  GraduationCap,
  AlarmClock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { GitHubSvg, HelloLmsPng, KonkukLogo } from "@/assets";
import React from "react";

const LinkList = [
  {
    icon: Home,
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
  {
    icon: GraduationCap,
    label: "학사정보시스템",
    link: "https://kuis.konkuk.ac.kr/index.do",
  },
  { icon: Clock, label: "수강신청", link: "https://sugang.konkuk.ac.kr" },
  {
    icon: BookCopy,
    label: "상허기념도서관",
    link: "https://library.konkuk.ac.kr/",
  },
  {
    icon: CalendarDays,
    label: "학사일정",
    link: "https://korea.konkuk.ac.kr/konkuk/2161/subview.do",
  },
  {
    icon: AlarmClock,
    color: "#E01216",
    label: "에브리타임",
    link: "https://account.everytime.kr/login",
  },
  // { icon: GraduationCap, label: "나의 학과" },
  // { icon: Book, label: "전자출석부" },
];

const LinkGroup = () => {
  return (
    <div className="w-[400px] h-[500px] bg-white overflow-hidden">
      <LinkGroup.Header />
      <LinkGroup.Grid />
    </div>
  );
};

const Header = () => {
  return (
    <header className="p-4 border-b">
      <div className="flex items-center justify-between gap-4">
        <img
          src={KonkukLogo}
          alt="Konkuk University"
          className="h-8 flex-shrink-0"
        />
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
    <div className="grid grid-cols-3 gap-4 p-4">
      {LinkList.map((item, index) => (
        <button
          key={index}
          className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer"
          onClick={() => {
            window.open(item.link);
          }}
        >
          <div className="w-12 h-12 rounded-full bg-[#00913A]/10 flex items-center justify-center mb-2">
            {item.type === "png" ? (
              <img
                src={item.icon}
                alt={item.label}
                className="w-6 h-6 text-[#00913A]"
              />
            ) : (
              <item.icon className={`w-6 h-6 text-[#00913A]`} />
            )}
          </div>
          <span className="text-sm text-gray-700 text-center break-keep">
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
};

LinkGroup.Header = React.memo(Header);
LinkGroup.Grid = React.memo(Grid);

export default React.memo(LinkGroup);
