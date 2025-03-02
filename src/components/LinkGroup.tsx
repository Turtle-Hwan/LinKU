import { Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LinkuLogoSvg } from "@/assets";
import React, { Suspense } from "react";
import ImageCarousel from "./ImageCarousel";
import { LinkList, LinkList_long } from "@/constants/LinkList";
// import { getCurrentTab } from "@/utils/chrome";

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

const Grid = () => {
  // const HOSTNAME = "localhost";
  // console.log(window.location.hostname);
  // getCurrentTab().then((tab) => {
  //   console.log(tab);
  // });

  return (
    <div className="Link__Grid grid grid-cols-6 gap-4 p-4">
      {LinkList.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx === 6 &&
            LinkList_long.map((item, idx) => (
              <LinkGroup.GridItemLong key={idx} item={item} />
            ))}

          {/* {idx === 7 && <LinkGroup.GridItemSameHost key={idx} item={item} />}
          <LinkGroup.GridItem key={idx} item={item} /> */}

          {new URL(item.link).hostname === window.location.hostname &&
          item.samehost ? (
            <LinkGroup.GridItemSameHost key={idx} item={item} />
          ) : (
            <LinkGroup.GridItem key={idx} item={item} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const GridItemLong = ({ item }) => {
  return (
    <button
      className="col-span-3 flex flex-row items-center justify-start px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer"
      onClick={() => {
        window.open(item.link);
      }}
    >
      <div className="w-10 h-10 rounded-full bg-[#00913A]/10 flex items-center justify-center shrink-0">
        <item.icon className={`Icon__Animation w-5 h-5 text-[#00913A]`} />
      </div>
      <span className="w-full text-base text-black text-center break-keep">
        {item.label}
      </span>
    </button>
  );
};

const GridItem = ({ item }) => {
  return (
    <button
      className="col-span-2 flex flex-row items-center justify-start px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer"
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

const GridItemSameHost = ({ item }) => {
  console.log(item);
  return (
    <div className="col-span-2 flex flex-row items-center justify-start rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
      <button className="w-full h-full py-2 px-4 bg-[#00913A] text-white rounded-lg hover:bg-[#007a30] transition-colors cursor-pointer">
        {item.samehost}
      </button>

      {/* <button
        className="w-full py-2 px-4 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors"
        onClick={() => {
          alert("두 번째 버튼 동작");
        }}
      >
        버튼2
      </button> */}
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
LinkGroup.GridItemLong = React.memo(GridItemLong);
LinkGroup.GridItemSameHost = React.memo(GridItemSameHost);
LinkGroup.Banner = React.memo(Banner);
LinkGroup.Footer = React.memo(Footer);

export default React.memo(LinkGroup);
