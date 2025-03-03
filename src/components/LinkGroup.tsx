import { Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LinkuLogoSvg } from "@/assets";
import React, { Suspense, use } from "react";
import ImageCarousel from "./ImageCarousel";
import { LinkList } from "@/constants/LinkList";
import { getCurrentTab } from "@/utils/chrome";

const LinkGroup = () => {
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
  const [text, setText] = React.useState<string>("");

  return (
    <header className="p-4 border-b">
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
            onClick={() => {
              alert("아직 기능이 준비 중이에요.");
            }}
          />
          {/* <GitHubSvg
            className="w-5 h-5 text-gray-600 cursor-pointer"
            onClick={() => {
              window.open("https://github.com/Turtle-Hwan/LinKU");
            }}
          /> */}
        </div>
      </div>
    </header>
  );
};

const tabPromise = getCurrentTab();

const Grid = () => {
  const tab = use(tabPromise);
  const tabHostname = new URL(tab.url ?? "").hostname;

  return (
    <div className="Link__Grid grid grid-cols-6 gap-4 p-4">
      {LinkList.map((item, idx) => {
        const isSameHost =
          new URL(item.link).hostname === tabHostname && item.samehost;
        const GridItem = isSameHost
          ? LinkGroup.GridItemSameHost
          : LinkGroup.GridItem;
        const colNum = item.islong ? 3 : 2;

        return <GridItem key={idx} item={item} colNum={colNum} />;
      })}
    </div>
  );
};

const GridItem = ({ item, colNum }) => {
  return (
    <button
      className={`col-span-${colNum} flex flex-row items-center justify-start px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer`}
      onClick={() => {
        window.open(item.link);
      }}
    >
      <div className="w-9 h-9 rounded-full bg-[#00913A]/10 flex items-center justify-center shrink-0">
        {item.type === "png" ? (
          <img
            src={item.icon}
            alt={item.label + ` 이미지`}
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

const GridItemSameHost = ({ item, colNum }) => {
  return (
    <div
      className={`col-span-${colNum} flex flex-row items-center justify-between gap-1.5 rounded-lg hover:bg-gray-100 transition-colors`}
    >
      <button
        className="w-full h-full px-1 bg-[#00913A] text-white rounded-lg hover:bg-[#007a30] transition-colors cursor-pointer text-sm/[normal] break-keep"
        onClick={item.samehost.onClick}
      >
        {item.samehost.content}
      </button>

      {item.samehost2 && (
        <button
          className="w-full h-full px-1 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors cursor-pointer text-sm/[normal] break-keep"
          onClick={item.samehost2.onClick}
        >
          {item.samehost2.content}
        </button>
      )}
    </div>
  );
};

const Banner = () => {
  return (
    <div className="mt-auto group">
      <Suspense fallback={<BannerImgSkeleton />}>
        <ImageCarousel />
      </Suspense>
    </div>
  );
};

const BannerImgSkeleton = () => {
  return (
    <div className="w-[500px] h-[87px] bg-[#00913A]/10 animate-pulse rounded-md overflow-hidden flex items-center justify-between">
      <div className="flex-1 h-full flex items-center justify-center">
        <div className="w-[450px] h-[67px] bg-[#00913A]/15 rounded-md"></div>
      </div>
    </div>
  );
};

const Footer = () => {
  return <></>;
};

LinkGroup.Header = React.memo(Header);
LinkGroup.Grid = React.memo(Grid);
LinkGroup.GridItem = React.memo(GridItem);
LinkGroup.GridItemSameHost = React.memo(GridItemSameHost);
LinkGroup.Banner = React.memo(Banner);
LinkGroup.Footer = React.memo(Footer);

export default React.memo(LinkGroup);
