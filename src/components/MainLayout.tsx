import React, { Suspense, useState } from "react";
import ImageCarousel from "./Tabs/ImageCarousel";
import { GitHubSvg, LinkuLogoSvg } from "@/assets";
import { Input } from "./ui/input";
import { Search, Settings } from "lucide-react";
import SettingsDialog from "./SettingsDialog";

const MainLayout = ({ children }) => {
  return (
    <div className="w-[500px] h-[600px] flex flex-col bg-white overflow-hidden">
      <MainLayout.Header />
      {children}
      <MainLayout.Banner />
    </div>
  );
};

const Header = () => {
  const [text, setText] = React.useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <LinkuLogoSvg
          className="cursor-pointer"
          onClick={() => {
            window.open(`https://github.com/Turtle-Hwan/LinKU`);
          }}
        />
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="검색어 입력"
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            onChange={(e) => setText((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                window.open(
                  `https://search.konkuk.ac.kr/main.do?keyword=${text}`
                );
              }
            }}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Settings
            className="w-5 h-5 text-gray-600 cursor-pointer"
            onClick={() => setShowSettings(true)}
          />
          <GitHubSvg
            className="w-5 h-5 text-gray-600 cursor-pointer"
            onClick={() => {
              window.open("https://github.com/Turtle-Hwan/LinKU");
            }}
          />
        </div>
      </div>

      {/* 설정 다이얼로그 */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </header>
  );
};

const Banner = () => {
  return (
    <div className="group mt-auto">
      <Suspense fallback={<BannerImgSkeleton />}>
        <ImageCarousel />
      </Suspense>
    </div>
  );
};

const BannerImgSkeleton = () => {
  return (
    <div className="w-[500px] h-[85px] bg-[#00913A]/10 animate-pulse rounded-md overflow-hidden flex items-center justify-between">
      <div className="flex-1 h-full flex items-center justify-center">
        <div className="w-[450px] h-[65px] bg-[#00913A]/15 rounded-md"></div>
      </div>
    </div>
  );
};

MainLayout.Header = React.memo(Header);
MainLayout.Banner = React.memo(Banner);
export default React.memo(MainLayout);
