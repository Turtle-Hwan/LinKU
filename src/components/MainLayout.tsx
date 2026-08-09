import { memo, Suspense, useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router";
import ImageCarousel from "./Tabs/ImageCarousel";
import { GitHubSvg, LinkuLogoSvg } from "@/assets";
import { Input } from "./ui/input";
import { Search, Settings, FlaskConical, Mail } from "lucide-react";
import SettingsDialog from "./SettingsDialog";
import LabsDialog from "./LabsDialog";
import FeedbackDialog from "./FeedbackDialog";
import { flushFeedbackOutbox } from "@/apis/feedback";
import { sendButtonClick, sendSearchSubmit } from "@/utils/analytics";

const MainLayout = () => {
  return (
    <div className="w-[500px] h-[600px] flex flex-col bg-white overflow-hidden">
      <MainLayout.Header />
      <Outlet />
      <MainLayout.Banner />
    </div>
  );
};

interface HeaderActionButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

type HeaderDialog = "feedback" | "labs" | "settings";

const HeaderActionButton = ({
  label,
  onClick,
  children,
}: HeaderActionButtonProps) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main/40"
      onClick={onClick}
    >
      {children}
    </button>
  );
};

const Header = () => {
  const [text, setText] = useState("");
  const [activeDialog, setActiveDialog] = useState<HeaderDialog | null>(null);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) setActiveDialog(null);
  };

  useEffect(() => {
    void flushFeedbackOutbox();

    const retryWhenOnline = () => void flushFeedbackOutbox();
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, []);

  return (
    <header className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <LinkuLogoSvg
          className="cursor-pointer"
          onClick={() => {
            sendButtonClick("logo_github", "header");
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
                sendSearchSubmit(text, "header");
                window.open(
                  `https://search.konkuk.ac.kr/main.do?keyword=${text}`
                );
              }
            }}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>
        <div className="grid w-32 shrink-0 grid-cols-4 items-center justify-items-center">
          <HeaderActionButton
            label="GitHub에서 보기"
            onClick={() => {
              sendButtonClick("github_icon", "header");
              window.open("https://github.com/Turtle-Hwan/LinKU");
            }}
          >
            <GitHubSvg className="size-4 fill-current" aria-hidden="true" />
          </HeaderActionButton>
          <HeaderActionButton
            label="LinKU에 의견 보내기"
            onClick={() => {
              sendButtonClick("voc_icon", "header");
              setActiveDialog("feedback");
            }}
          >
            <Mail className="size-5" aria-hidden="true" />
          </HeaderActionButton>
          <HeaderActionButton
            label="실험실 열기"
            onClick={() => setActiveDialog("labs")}
          >
            <FlaskConical className="size-5" aria-hidden="true" />
          </HeaderActionButton>
          <HeaderActionButton
            label="설정 열기"
            onClick={() => {
              sendButtonClick("settings_icon", "header");
              setActiveDialog("settings");
            }}
          >
            <Settings className="size-5" aria-hidden="true" />
          </HeaderActionButton>
        </div>
      </div>

      <LabsDialog
        open={activeDialog === "labs"}
        onOpenChange={handleDialogOpenChange}
      />

      <SettingsDialog
        open={activeDialog === "settings"}
        onOpenChange={handleDialogOpenChange}
      />

      <FeedbackDialog
        open={activeDialog === "feedback"}
        onOpenChange={handleDialogOpenChange}
      />
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
    <div className="w-[500px] h-[85px] bg-main/10 animate-pulse rounded-md overflow-hidden flex items-center justify-between">
      <div className="flex-1 h-full flex items-center justify-center">
        <div className="w-[450px] h-[65px] bg-main/15 rounded-md"></div>
      </div>
    </div>
  );
};

MainLayout.Header = memo(Header);
MainLayout.Banner = memo(Banner);
export default memo(MainLayout);
