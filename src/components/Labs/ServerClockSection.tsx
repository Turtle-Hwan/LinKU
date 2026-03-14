import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info, RefreshCw, Check } from "lucide-react";
import { useServerTime } from "./useServerTime";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DEFAULT_SERVER_URL = "https://sugang.konkuk.ac.kr";

const ServerClockSection = () => {
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_SERVER_URL);
  const [activeUrl, setActiveUrl] = useState<string>(DEFAULT_SERVER_URL);
  const { serverTime, rtt, lastSync, isLoading, error, refresh } =
    useServerTime(activeUrl);

  const handleApplyUrl = () => {
    if (inputUrl.trim()) {
      setActiveUrl(inputUrl.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleApplyUrl();
    }
  };

  // URL에서 hostname 추출
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return "--:--:--.---";
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const milliseconds = date.getMilliseconds().toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "----년 --월 --일 (--)";
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = DAYS[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  const formatLastSync = (date: Date | null): string => {
    if (!date) return "--:--:--";
    return formatTime(date);
  };

  return (
    <div className="space-y-4 pt-4 mt-4 border-t">
      <h2 className="text-base font-semibold">서버시계</h2>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://sugang.konkuk.ac.kr"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleApplyUrl}
            disabled={isLoading}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {getHostname(activeUrl)} 사이트의 서버시간입니다.
          </p>
        </div>

        {error ? (
          <div className="text-center py-4 text-red-500 text-sm">{error}</div>
        ) : (
          <div className="text-center py-4">
            <p className="text-4xl font-mono font-bold text-primary">
              {formatTime(serverTime)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatDate(serverTime)}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>

          <div className="text-xs text-muted-foreground space-y-0.5 text-right">
            <p>마지막 동기화: {formatLastSync(lastSync)}</p>
            <p>네트워크 지연: {rtt}ms</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerClockSection;
