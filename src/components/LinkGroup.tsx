import { Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LinkuLogoSvg } from "@/assets";
import React, { useEffect } from "react";
import ImageCarousel from "./ImageCarousel";
import { LinkList, LinkList_long } from "@/constants/LinkList";

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
  const [text, setText] = React.useState<string>("");

  useEffect(() => {
    console.log(text);
  }, [text]);

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
