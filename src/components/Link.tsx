import {
  Search,
  Settings,
  Github,
  Bell,
  Home,
  Calendar,
  Book,
  Clock,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Link() {
  return (
    <div className="w-[400px] h-[500px] bg-white overflow-hidden">
      {/* Header */}
      <header className="p-4 border-b">
        <div className="flex items-center justify-between gap-4">
          <img
            src="https://www.konkuk.ac.kr/cms/Common/images/ui/login_logo.png"
            alt="Konkuk University"
            className="h-8 flex-shrink-0"
          />
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="검색어 입력(캠퍼스, 행사, 전공, 교수 등)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Settings className="w-5 h-5 text-gray-600 cursor-pointer" />
            <Github className="w-5 h-5 text-gray-600 cursor-pointer" />
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {[
          { icon: Home, label: "홈페이지" },
          { icon: Bell, label: "공지사항" },
          { icon: Book, label: "포털" },
          { icon: Calendar, label: "학사일정" },
          { icon: Clock, label: "수강신청" },
          { icon: Book, label: "중앙도서관" },
          { icon: Trophy, label: "위인전" },
          { icon: Book, label: "학사서비스" },
          { icon: GraduationCap, label: "나의 학과" },
          { icon: Clock, label: "에브리타임" },
          { icon: Book, label: "전자출석부" },
          { icon: Calendar, label: "학사일정" },
        ].map((item, index) => (
          <button
            key={index}
            className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <div className="w-12 h-12 rounded-full bg-[#00913A]/10 flex items-center justify-center mb-2">
              <item.icon className="w-6 h-6 text-[#00913A]" />
            </div>
            <span className="text-sm text-gray-700 text-center">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
